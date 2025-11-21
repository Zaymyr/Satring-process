import { NextResponse } from 'next/server';
import { z } from 'zod';

import { parseJobDescriptionContent, collapseBlocksToText } from '@/lib/job-descriptions/format';
import { createServerClient } from '@/lib/supabase/server';
import { fetchUserOrganizations, getAccessibleOrganizationIds } from '@/lib/organization/memberships';
import { jobDescriptionSchema } from '@/lib/validation/job-description';

import { NO_STORE_HEADERS, roleIdParamSchema } from '@/app/api/departments/helpers';

const normalizeTimestamp = (value: unknown) => {
  const date = value instanceof Date ? value : new Date(value as string);
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }

  return date.toISOString();
};

const exportQuerySchema = z.object({
  format: z.enum(['pdf', 'doc']).default('pdf')
});

const normalizeRole = (rawRole: unknown) => {
  if (!rawRole || typeof rawRole !== 'object') {
    return { name: 'Rôle', departmentName: 'Département', organizationId: '' };
  }

  const roleObject = rawRole as {
    name?: unknown;
    organization_id?: unknown;
    department?: { name?: unknown } | { name?: unknown }[] | null;
  };

  const departmentName = (() => {
    const rawDepartment = roleObject.department;
    if (Array.isArray(rawDepartment)) {
      const firstDepartment = rawDepartment[0];
      return typeof firstDepartment?.name === 'string' ? firstDepartment.name : undefined;
    }

    if (rawDepartment && typeof rawDepartment === 'object' && 'name' in rawDepartment) {
      return typeof (rawDepartment as { name?: unknown }).name === 'string'
        ? (rawDepartment as { name?: unknown }).name
        : undefined;
    }

    return undefined;
  })();

  return {
    name: typeof roleObject.name === 'string' && roleObject.name.trim().length > 0 ? roleObject.name.trim() : 'Rôle',
    departmentName:
      typeof departmentName === 'string' && departmentName.trim().length > 0
        ? departmentName.trim()
        : 'Département',
    organizationId:
      typeof roleObject.organization_id === 'string'
        ? roleObject.organization_id
        : String(roleObject.organization_id ?? '')
  };
};

const normalizeJobDescriptionRecord = (record: {
  role_id?: unknown;
  organization_id?: unknown;
  content?: unknown;
  updated_at?: unknown;
  created_at?: unknown;
}) => ({
  roleId: typeof record.role_id === 'string' ? record.role_id : String(record.role_id ?? ''),
  organizationId:
    typeof record.organization_id === 'string'
      ? record.organization_id
      : String(record.organization_id ?? ''),
  content: typeof record.content === 'string' ? record.content.trim() : '',
  updatedAt: normalizeTimestamp(record.updated_at ?? record.created_at ?? new Date())
});

const buildSafeFilename = (roleName: string, extension: string) => {
  const normalized = roleName
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');

  const fallback = normalized.length > 0 ? normalized : 'role';
  return `fiche-${fallback}.${extension}`;
};

const escapePdfText = (value: string) =>
  value
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/\r?\n/g, ' ');

const createPdfBuffer = (params: {
  roleName: string;
  departmentName: string;
  updatedAt: string;
  lines: string[];
}) => {
  const textLines = [
    params.roleName,
    params.departmentName,
    `Dernière mise à jour : ${new Date(params.updatedAt).toLocaleString('fr-FR')}`,
    ...params.lines
  ];

  let currentY = 760;
  const contentStream = textLines
    .map((line, index) => {
      const fontSize = index === 0 ? 18 : index === 1 ? 12 : 11;
      const command = `BT /F1 ${fontSize} Tf 72 ${currentY} Td (${escapePdfText(line)}) Tj ET`;
      currentY -= fontSize + 6;
      return command;
    })
    .join('\n');

  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj',
    `4 0 obj << /Length ${Buffer.byteLength(contentStream, 'utf8')} >> stream\n${contentStream}\nendstream endobj`,
    '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj'
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];

  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += `${object}\n`;
  }

  const xrefStart = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (const offset of offsets) {
    pdf += `${offset.toString().padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return Buffer.from(pdf, 'utf8');
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const buildDocContent = (params: {
  roleName: string;
  departmentName: string;
  updatedAt: string;
  blocks: ReturnType<typeof parseJobDescriptionContent>;
}) => {
  const renderedBlocks = params.blocks
    .map((block) => {
      if (block.type === 'heading') {
        return `<h3 style="text-transform: uppercase; font-size: 12px; color: #475569; letter-spacing: 0.05em;">${escapeHtml(block.text)}</h3>`;
      }

      if (block.type === 'list') {
        const items = block.items
          .map((item) => `<li style="margin-bottom: 4px; color: #0f172a;">${escapeHtml(item)}</li>`)
          .join('');
        return `<ul style="padding-left: 20px; margin: 0 0 10px 0;">${items}</ul>`;
      }

      return `<p style="margin: 6px 0; color: #0f172a;">${escapeHtml(block.text)}</p>`;
    })
    .join('');

  return `<!DOCTYPE html>
  <html lang="fr">
    <head>
      <meta charSet="utf-8" />
      <style>
        body { font-family: Arial, sans-serif; color: #0f172a; }
      </style>
    </head>
    <body>
      <h1 style="margin: 0; font-size: 22px; color: #0f172a;">${escapeHtml(params.roleName)}</h1>
      <p style="margin: 4px 0 12px 0; color: #475569;">${escapeHtml(params.departmentName)}</p>
      <p style="margin: 0 0 12px 0; font-size: 12px; color: #64748b;">Dernière mise à jour : ${escapeHtml(
        new Date(params.updatedAt).toLocaleString('fr-FR')
      )}</p>
      ${renderedBlocks}
    </body>
  </html>`;
};

export async function GET(request: Request, { params }: { params: { roleId: string } }) {
  const parsedParams = roleIdParamSchema.safeParse(params ?? {});

  if (!parsedParams.success) {
    return NextResponse.json({ error: 'Identifiant de rôle invalide.' }, { status: 400, headers: NO_STORE_HEADERS });
  }

  const query = exportQuerySchema.safeParse({ format: new URL(request.url).searchParams.get('format') ?? 'pdf' });

  if (!query.success) {
    return NextResponse.json({ error: 'Format de téléchargement invalide.' }, { status: 400, headers: NO_STORE_HEADERS });
  }

  const supabase = createServerClient();
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Authentification requise.' }, { status: 401, headers: NO_STORE_HEADERS });
  }

  let memberships;

  try {
    memberships = await fetchUserOrganizations(supabase);
  } catch (membershipError) {
    console.error('Erreur lors de la récupération des organisations pour le téléchargement de fiche de poste', membershipError);
    return NextResponse.json(
      { error: "Impossible d'identifier l'organisation cible." },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  const accessibleOrganizationIds = getAccessibleOrganizationIds(memberships);

  if (accessibleOrganizationIds.length === 0) {
    return NextResponse.json({ error: 'Aucune organisation accessible.' }, { status: 403, headers: NO_STORE_HEADERS });
  }

  const { data: record, error: fetchError } = await supabase
    .from('job_descriptions')
    .select('role_id, organization_id, content, updated_at, created_at, role:roles(name, organization_id, department:departments(name))')
    .eq('role_id', parsedParams.data.roleId)
    .maybeSingle();

  if (fetchError && fetchError.code !== 'PGRST116') {
    console.error('Erreur lors de la récupération de la fiche de poste pour export', fetchError);
    return NextResponse.json(
      { error: 'Impossible de récupérer la fiche de poste à exporter.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  if (!record) {
    return NextResponse.json({ error: 'Fiche de poste introuvable.' }, { status: 404, headers: NO_STORE_HEADERS });
  }

  const role = normalizeRole((record as { role?: unknown }).role);
  const normalizedDescription = normalizeJobDescriptionRecord(record);

  if (!accessibleOrganizationIds.includes(normalizedDescription.organizationId || role.organizationId)) {
    return NextResponse.json({ error: 'Fiche de poste inaccessible.' }, { status: 404, headers: NO_STORE_HEADERS });
  }

  const descriptionResult = jobDescriptionSchema.safeParse(normalizedDescription);

  if (!descriptionResult.success) {
    console.error('Fiche de poste invalide pour export', descriptionResult.error);
    return NextResponse.json(
      { error: 'Les données de la fiche de poste sont invalides.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  const blocks = parseJobDescriptionContent(descriptionResult.data.content);
  const filename = buildSafeFilename(role.name, query.data.format === 'pdf' ? 'pdf' : 'doc');

  if (query.data.format === 'doc') {
    const html = buildDocContent({
      roleName: role.name,
      departmentName: role.departmentName,
      updatedAt: descriptionResult.data.updatedAt,
      blocks
    });

    return new NextResponse(html, {
      status: 200,
      headers: {
        ...NO_STORE_HEADERS,
        'Content-Type': 'application/msword; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    });
  }

  const pdfBuffer = await createPdfBuffer({
    roleName: role.name,
    departmentName: role.departmentName,
    updatedAt: descriptionResult.data.updatedAt,
    lines: collapseBlocksToText(blocks)
  });

  return new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      ...NO_STORE_HEADERS,
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`
    }
  });
}
