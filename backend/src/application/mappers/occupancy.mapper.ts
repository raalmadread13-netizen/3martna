import { Occupancy } from '@domain/business/Occupancy';
import { OccupancyDto } from '@application/dtos/occupancy.dto';
import { iso, isoRequired } from './common';

export const toOccupancyDto = (occupancy: Occupancy): OccupancyDto => {
  const p = occupancy.toProps();
  return {
    id: p.id,
    tenantId: p.tenantId,
    apartmentId: p.apartmentId,
    residentId: p.residentId,
    leaseContractId: p.leaseContractId,
    moveInDate: isoRequired(p.moveInDate),
    moveOutDate: iso(p.moveOutDate),
    moveOutReason: p.moveOutReason,
    isActive: occupancy.isActive,
    createdAt: isoRequired(p.createdAt),
  };
};
