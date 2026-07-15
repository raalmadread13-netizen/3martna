import { Entity, EntityProps, newEntityProps } from '@domain/common/Entity';
import { invariant } from '@domain/common/DomainError';
import { newId } from '@domain/common/identity';

export type EmployeePosition =
  'Manager' | 'Maintenance' | 'Security' | 'Cleaning' | 'Concierge' | 'Other';

export interface BuildingEmployeeProps extends EntityProps {
  buildingId: string;
  userId: string;
  position: EmployeePosition;
  hiredOn: Date | null;
  endedOn: Date | null;
}

/**
 * Aggregate root: a staff assignment linking a User to a Building in a
 * given role. An assignment with no endedOn is currently active; ending it
 * preserves history rather than deleting the row.
 */
export class BuildingEmployee extends Entity {
  readonly buildingId: string;
  readonly userId: string;
  readonly position: EmployeePosition;
  readonly hiredOn: Date | null;
  private _endedOn: Date | null;

  private constructor(props: BuildingEmployeeProps) {
    super(props);
    this.buildingId = props.buildingId;
    this.userId = props.userId;
    this.position = props.position;
    this.hiredOn = props.hiredOn;
    this._endedOn = props.endedOn;
  }

  static assign(
    tenantId: string,
    input: {
      buildingId: string;
      userId: string;
      position: EmployeePosition;
      hiredOn?: Date | null;
    },
    actorId: string | null,
  ): BuildingEmployee {
    return new BuildingEmployee({
      ...newEntityProps(newId(), tenantId, actorId),
      buildingId: input.buildingId,
      userId: input.userId,
      position: input.position,
      hiredOn: input.hiredOn ?? new Date(),
      endedOn: null,
    });
  }

  static restore(props: BuildingEmployeeProps): BuildingEmployee {
    return new BuildingEmployee(props);
  }

  get endedOn(): Date | null {
    return this._endedOn;
  }
  get isActive(): boolean {
    return this._endedOn === null && !this.isDeleted;
  }

  end(on: Date, actorId: string | null): void {
    this.assertNotDeleted();
    invariant(this._endedOn === null, 'EMPLOYEE_ENDED', 'Assignment has already ended');
    invariant(
      this.hiredOn === null || on.getTime() >= this.hiredOn.getTime(),
      'EMPLOYEE_END_DATE',
      'End date cannot precede the hire date',
    );
    this._endedOn = on;
    this.touch(actorId);
  }

  toProps(): BuildingEmployeeProps {
    return {
      ...this.entityProps(),
      buildingId: this.buildingId,
      userId: this.userId,
      position: this.position,
      hiredOn: this.hiredOn,
      endedOn: this._endedOn,
    };
  }
}
