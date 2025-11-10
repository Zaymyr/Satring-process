import type { Department } from '@/lib/validation/department';
import type { Role } from '@/lib/validation/role';

type DemoDepartment = Omit<Department, 'roles'> & { roles: readonly Role[] };

const INVITE_DEMO_TIMESTAMP = '2024-01-01T12:00:00.000Z';

const INVITE_DEMO_DEPARTMENTS: readonly DemoDepartment[] = [
  {
    id: 'd2f2d9f4-4e3b-4f4e-bcf3-1a2b3c4d5e60',
    name: 'Opérations',
    color: '#C7D2FE',
    createdAt: INVITE_DEMO_TIMESTAMP,
    updatedAt: INVITE_DEMO_TIMESTAMP,
    roles: [
      {
        id: '6e6a9d2c-2ff2-4bc0-9f78-14d55c832601',
        departmentId: 'd2f2d9f4-4e3b-4f4e-bcf3-1a2b3c4d5e60',
        name: 'Chef de projet',
        color: '#818CF8',
        createdAt: INVITE_DEMO_TIMESTAMP,
        updatedAt: INVITE_DEMO_TIMESTAMP
      },
      {
        id: 'a94a6c33-5945-4f24-9b61-6a4d7b9104b2',
        departmentId: 'd2f2d9f4-4e3b-4f4e-bcf3-1a2b3c4d5e60',
        name: 'Analyste qualité',
        color: '#60A5FA',
        createdAt: INVITE_DEMO_TIMESTAMP,
        updatedAt: INVITE_DEMO_TIMESTAMP
      }
    ]
  },
  {
    id: '8c1fb6d5-15ef-4f13-8d0a-9c89a7fa1234',
    name: 'Support client',
    color: '#FDE68A',
    createdAt: INVITE_DEMO_TIMESTAMP,
    updatedAt: INVITE_DEMO_TIMESTAMP,
    roles: [
      {
        id: '9fb9f4f1-9f9a-4c13-9d6b-8c21d5f9d0ef',
        departmentId: '8c1fb6d5-15ef-4f13-8d0a-9c89a7fa1234',
        name: 'Conseiller support',
        color: '#F59E0B',
        createdAt: INVITE_DEMO_TIMESTAMP,
        updatedAt: INVITE_DEMO_TIMESTAMP
      },
      {
        id: '50b99a5d-77dd-4a66-87f6-25dfb0ef2c3a',
        departmentId: '8c1fb6d5-15ef-4f13-8d0a-9c89a7fa1234',
        name: 'Lead support',
        color: '#F97316',
        createdAt: INVITE_DEMO_TIMESTAMP,
        updatedAt: INVITE_DEMO_TIMESTAMP
      }
    ]
  },
  {
    id: '3f4a9b9e-6c12-4d5e-9b2f-5a6d7c8e9f10',
    name: 'Produit',
    color: '#A5F3FC',
    createdAt: INVITE_DEMO_TIMESTAMP,
    updatedAt: INVITE_DEMO_TIMESTAMP,
    roles: [
      {
        id: '41d2b2f6-9d1f-4c4c-8f6a-2b7d9c0e1f2a',
        departmentId: '3f4a9b9e-6c12-4d5e-9b2f-5a6d7c8e9f10',
        name: 'Product manager',
        color: '#22D3EE',
        createdAt: INVITE_DEMO_TIMESTAMP,
        updatedAt: INVITE_DEMO_TIMESTAMP
      },
      {
        id: 'c0f1a2b3-4d5e-6f7a-8b9c-0d1e2f3a4b5c',
        departmentId: '3f4a9b9e-6c12-4d5e-9b2f-5a6d7c8e9f10',
        name: 'UX designer',
        color: '#2DD4BF',
        createdAt: INVITE_DEMO_TIMESTAMP,
        updatedAt: INVITE_DEMO_TIMESTAMP
      }
    ]
  }
] as const satisfies readonly DemoDepartment[];

export function getInviteDemoDepartments(): Department[] {
  return INVITE_DEMO_DEPARTMENTS.map((department) => ({
    ...department,
    roles: department.roles.map((role) => ({ ...role }))
  }));
}
