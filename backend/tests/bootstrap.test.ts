import { BootstrapSuperAdmin } from '@application/use-cases/admin/BootstrapSuperAdmin';
import { buildTestWorld, FakePasswordHasher, TestWorld } from './fakes';

const input = {
  firstName: 'Rana',
  lastName: 'Admin',
  email: 'admin@3martna.jo',
  phoneNumber: '+962790009999',
  password: 'Password123',
};

describe('BootstrapSuperAdmin', () => {
  let world: TestWorld;
  let bootstrap: BootstrapSuperAdmin;

  beforeEach(() => {
    world = buildTestWorld();
    bootstrap = new BootstrapSuperAdmin(
      world.users,
      world.roles,
      new FakePasswordHasher(),
      world.auditLogs,
    );
  });

  it('creates the first SuperAdmin with the full permission set', async () => {
    const result = await bootstrap.execute(input);
    expect(result.email).toBe(input.email);

    const auth = await world.roles.getUserAuthorization(result.userId);
    expect(auth.roles).toEqual(['SuperAdmin']);
    expect(auth.permissions).toContain('users.manage');
    expect(world.auditLogs.actions()).toContain('SUPERADMIN_BOOTSTRAPPED');
    // Password is stored hashed, never in plain form
    expect(world.users.users[0].passwordHash).not.toBe(input.password);
  });

  it('refuses to run when a SuperAdmin already exists', async () => {
    await bootstrap.execute(input);
    await expect(
      bootstrap.execute({ ...input, email: 'second@3martna.jo', phoneNumber: '+962790008888' }),
    ).rejects.toMatchObject({ code: 'SUPERADMIN_EXISTS' });
  });

  it('enforces the password policy', async () => {
    await expect(bootstrap.execute({ ...input, password: 'weak' })).rejects.toMatchObject({
      code: 'WEAK_PASSWORD',
    });
  });

  it('rejects duplicate email or phone', async () => {
    await world.users.create({
      firstName: 'X',
      lastName: 'Y',
      email: input.email,
      phoneNumber: '+962790007777',
      passwordHash: 'hashed:x',
      preferredLanguage: 'ar',
      createdBy: null,
    });
    await expect(bootstrap.execute(input)).rejects.toMatchObject({
      code: 'EMAIL_ALREADY_REGISTERED',
    });
  });
});
