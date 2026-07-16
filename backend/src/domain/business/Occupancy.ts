import { AggregateRoot } from '@domain/common/AggregateRoot';
import { EntityProps, newEntityProps } from '@domain/common/Entity';
import { invariant } from '@domain/common/DomainError';
import { newId } from '@domain/common/identity';
import { IClock } from '@domain/common/time/IClock';

export interface OccupancyProps extends EntityProps {
  apartmentId: string;
  residentId: string;
  leaseContractId: string;
  moveInDate: Date;
  moveOutDate: Date | null;
  moveOutReason: string | null;
}

/**
 * Aggregate root: one stay of one resident in one apartment, always backed
 * by a lease (move-in requires an active lease). A stay is ACTIVE while
 * moveOutDate is null; moving out CLOSES the record — occupancy rows are
 * the historical ledger and are never deleted. The "one active stay per
 * apartment / per resident" invariants are guarded in the application layer
 * and physically by the filtered unique indexes of migration 0003.
 */
export class Occupancy extends AggregateRoot {
  readonly apartmentId: string;
  readonly residentId: string;
  readonly leaseContractId: string;
  readonly moveInDate: Date;
  private _moveOutDate: Date | null;
  private _moveOutReason: string | null;

  private constructor(props: OccupancyProps) {
    super(props);
    this.apartmentId = props.apartmentId;
    this.residentId = props.residentId;
    this.leaseContractId = props.leaseContractId;
    this.moveInDate = props.moveInDate;
    this._moveOutDate = props.moveOutDate;
    this._moveOutReason = props.moveOutReason;
  }

  /** Open a stay (Move-In). `moveInDate` is the business-effective date. */
  static open(
    tenantId: string,
    input: {
      apartmentId: string;
      residentId: string;
      leaseContractId: string;
      moveInDate: Date;
    },
    actorId: string | null,
    clock: IClock,
  ): Occupancy {
    invariant(
      input.moveInDate instanceof Date && !Number.isNaN(input.moveInDate.getTime()),
      'OCCUPANCY_MOVEIN_DATE',
      'A valid move-in date is required',
    );
    return new Occupancy({
      ...newEntityProps(newId(), tenantId, actorId, clock.now()),
      apartmentId: input.apartmentId,
      residentId: input.residentId,
      leaseContractId: input.leaseContractId,
      moveInDate: input.moveInDate,
      moveOutDate: null,
      moveOutReason: null,
    });
  }

  static restore(props: OccupancyProps): Occupancy {
    return new Occupancy(props);
  }

  get moveOutDate(): Date | null {
    return this._moveOutDate;
  }
  get moveOutReason(): string | null {
    return this._moveOutReason;
  }
  get isActive(): boolean {
    return this._moveOutDate === null && !this.isDeleted;
  }

  /** Close the stay (Move-Out). History stays — nothing is deleted. */
  close(moveOutDate: Date, reason: string | null, actorId: string | null, clock: IClock): void {
    this.assertNotDeleted();
    invariant(!this._moveOutDate, 'OCCUPANCY_CLOSED', 'Occupancy is already closed');
    invariant(
      moveOutDate.getTime() >= this.moveInDate.getTime(),
      'OCCUPANCY_MOVEOUT_DATE',
      'Move-out date cannot precede move-in date',
    );
    this._moveOutDate = moveOutDate;
    this._moveOutReason = reason?.trim() || null;
    this.touch(actorId, clock.now());
  }

  toProps(): OccupancyProps {
    return {
      ...this.entityProps(),
      apartmentId: this.apartmentId,
      residentId: this.residentId,
      leaseContractId: this.leaseContractId,
      moveInDate: this.moveInDate,
      moveOutDate: this._moveOutDate,
      moveOutReason: this._moveOutReason,
    };
  }
}
