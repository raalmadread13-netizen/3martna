import { AggregateRoot } from '@domain/common/AggregateRoot';
import { EntityProps, newEntityProps } from '@domain/common/Entity';
import { invariant } from '@domain/common/DomainError';
import { newId } from '@domain/common/identity';
import { IClock } from '@domain/common/time/IClock';

export type OwnerType = 'Individual' | 'Company';

export interface OwnerProps extends EntityProps {
  ownerType: OwnerType;
  userId: string | null;
  fullName: string;
  companyName: string | null;
  nationalIdOrRegistration: string | null;
  email: string | null;
  phoneNumber: string | null;
  address: string | null;
}

/**
 * Aggregate root: the legal owner of one or more apartments — an
 * individual or a company. May optionally be linked to an app account
 * (Users) once the owner registers.
 */
export class Owner extends AggregateRoot {
  readonly ownerType: OwnerType;
  private _userId: string | null;
  private _fullName: string;
  private _companyName: string | null;
  private _nationalIdOrRegistration: string | null;
  private _email: string | null;
  private _phoneNumber: string | null;
  private _address: string | null;

  private constructor(props: OwnerProps) {
    super(props);
    this.ownerType = props.ownerType;
    this._userId = props.userId;
    this._fullName = props.fullName;
    this._companyName = props.companyName;
    this._nationalIdOrRegistration = props.nationalIdOrRegistration;
    this._email = props.email;
    this._phoneNumber = props.phoneNumber;
    this._address = props.address;
  }

  static create(
    tenantId: string,
    input: {
      ownerType?: OwnerType;
      fullName: string;
      companyName?: string | null;
      nationalIdOrRegistration?: string | null;
      email?: string | null;
      phoneNumber?: string | null;
      address?: string | null;
    },
    actorId: string | null,
    clock: IClock,
  ): Owner {
    const ownerType = input.ownerType ?? 'Individual';
    invariant(input.fullName.trim().length >= 2, 'OWNER_NAME', 'Owner name is required');
    invariant(
      ownerType !== 'Company' || (input.companyName?.trim().length ?? 0) >= 2,
      'OWNER_COMPANY',
      'Company owners require a company name',
    );
    return new Owner({
      ...newEntityProps(newId(), tenantId, actorId, clock.now()),
      ownerType,
      userId: null,
      fullName: input.fullName.trim(),
      companyName: input.companyName?.trim() || null,
      nationalIdOrRegistration: input.nationalIdOrRegistration?.trim() || null,
      email: input.email?.trim() || null,
      phoneNumber: input.phoneNumber?.trim() || null,
      address: input.address?.trim() || null,
    });
  }

  static restore(props: OwnerProps): Owner {
    return new Owner(props);
  }

  get userId(): string | null {
    return this._userId;
  }
  get fullName(): string {
    return this._fullName;
  }
  get companyName(): string | null {
    return this._companyName;
  }
  get nationalIdOrRegistration(): string | null {
    return this._nationalIdOrRegistration;
  }
  get email(): string | null {
    return this._email;
  }
  get phoneNumber(): string | null {
    return this._phoneNumber;
  }
  get address(): string | null {
    return this._address;
  }

  /** Link this owner to a registered app account (one-time). */
  linkUser(userId: string, actorId: string | null, clock: IClock): void {
    this.assertNotDeleted();
    invariant(!this._userId, 'OWNER_LINKED', 'Owner is already linked to an account');
    this._userId = userId;
    this.touch(actorId, clock.now());
  }

  updateContact(
    changes: Partial<{ email: string | null; phoneNumber: string | null; address: string | null }>,
    actorId: string | null,
    clock: IClock,
  ): void {
    this.assertNotDeleted();
    if (changes.email !== undefined) this._email = changes.email?.trim() || null;
    if (changes.phoneNumber !== undefined) this._phoneNumber = changes.phoneNumber?.trim() || null;
    if (changes.address !== undefined) this._address = changes.address?.trim() || null;
    this.touch(actorId, clock.now());
  }

  /** Edit identity attributes — same invariants as `create`. */
  updateDetails(
    changes: Partial<{
      fullName: string;
      companyName: string | null;
      nationalIdOrRegistration: string | null;
    }>,
    actorId: string | null,
    clock: IClock,
  ): void {
    this.assertNotDeleted();
    if (changes.fullName !== undefined) {
      invariant(changes.fullName.trim().length >= 2, 'OWNER_NAME', 'Owner name is required');
      this._fullName = changes.fullName.trim();
    }
    if (changes.companyName !== undefined) {
      invariant(
        this.ownerType !== 'Company' || (changes.companyName?.trim().length ?? 0) >= 2,
        'OWNER_COMPANY',
        'Company owners require a company name',
      );
      this._companyName = changes.companyName?.trim() || null;
    }
    if (changes.nationalIdOrRegistration !== undefined) {
      this._nationalIdOrRegistration = changes.nationalIdOrRegistration?.trim() || null;
    }
    this.touch(actorId, clock.now());
  }

  toProps(): OwnerProps {
    return {
      ...this.entityProps(),
      ownerType: this.ownerType,
      userId: this._userId,
      fullName: this._fullName,
      companyName: this._companyName,
      nationalIdOrRegistration: this._nationalIdOrRegistration,
      email: this._email,
      phoneNumber: this._phoneNumber,
      address: this._address,
    };
  }
}
