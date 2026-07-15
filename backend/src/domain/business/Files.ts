import { Entity, EntityProps, newEntityProps } from '@domain/common/Entity';
import { invariant } from '@domain/common/DomainError';
import { newId } from '@domain/common/identity';

export type DocumentCategory =
  'LeaseContract' | 'Identity' | 'Invoice' | 'Receipt' | 'Policy' | 'Other';

/* --------------------------- Attachment ------------------------- */

export interface AttachmentProps extends EntityProps {
  entityType: string;
  entityId: string;
  fileName: string;
  fileUrl: string;
  contentType: string;
  sizeBytes: number | null;
  uploadedByUserId: string;
}

/**
 * Aggregate root: a file attached to another entity (maintenance request,
 * complaint, ...). Polymorphic association is app-enforced via
 * (entityType, entityId); binaries live in Firebase Storage, only the URL
 * is stored here.
 */
export class Attachment extends Entity {
  readonly entityType: string;
  readonly entityId: string;
  readonly fileName: string;
  readonly fileUrl: string;
  readonly contentType: string;
  readonly sizeBytes: number | null;
  readonly uploadedByUserId: string;

  private constructor(props: AttachmentProps) {
    super(props);
    this.entityType = props.entityType;
    this.entityId = props.entityId;
    this.fileName = props.fileName;
    this.fileUrl = props.fileUrl;
    this.contentType = props.contentType;
    this.sizeBytes = props.sizeBytes;
    this.uploadedByUserId = props.uploadedByUserId;
  }

  static attach(
    tenantId: string,
    input: {
      entityType: string;
      entityId: string;
      fileName: string;
      fileUrl: string;
      contentType: string;
      sizeBytes?: number | null;
      uploadedByUserId: string;
    },
    actorId: string | null,
  ): Attachment {
    invariant(input.entityType.trim().length > 0, 'ATTACH_ENTITY_TYPE', 'Entity type is required');
    invariant(input.fileName.trim().length > 0, 'ATTACH_FILENAME', 'File name is required');
    invariant(/^https?:\/\//.test(input.fileUrl), 'ATTACH_URL', 'A valid file URL is required');
    invariant(
      input.sizeBytes == null || input.sizeBytes > 0,
      'ATTACH_SIZE',
      'File size must be positive',
    );
    return new Attachment({
      ...newEntityProps(newId(), tenantId, actorId),
      entityType: input.entityType.trim(),
      entityId: input.entityId,
      fileName: input.fileName.trim(),
      fileUrl: input.fileUrl,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes ?? null,
      uploadedByUserId: input.uploadedByUserId,
    });
  }

  static restore(props: AttachmentProps): Attachment {
    return new Attachment(props);
  }

  toProps(): AttachmentProps {
    return {
      ...this.entityProps(),
      entityType: this.entityType,
      entityId: this.entityId,
      fileName: this.fileName,
      fileUrl: this.fileUrl,
      contentType: this.contentType,
      sizeBytes: this.sizeBytes,
      uploadedByUserId: this.uploadedByUserId,
    };
  }
}

/* ---------------------------- Document -------------------------- */

export interface DocumentProps extends EntityProps {
  category: DocumentCategory;
  title: string;
  fileUrl: string;
  contentType: string;
  sizeBytes: number | null;
  ownerUserId: string;
  buildingId: string | null;
  apartmentId: string | null;
  version: number;
  previousDocumentId: string | null;
}

/**
 * Aggregate root: a first-class managed document (contract, ID, policy…)
 * with version chaining. A new version is a new aggregate pointing back at
 * its predecessor via previousDocumentId.
 */
export class Document extends Entity {
  readonly category: DocumentCategory;
  private _title: string;
  readonly fileUrl: string;
  readonly contentType: string;
  readonly sizeBytes: number | null;
  readonly ownerUserId: string;
  readonly buildingId: string | null;
  readonly apartmentId: string | null;
  readonly version: number;
  readonly previousDocumentId: string | null;

  private constructor(props: DocumentProps) {
    super(props);
    this.category = props.category;
    this._title = props.title;
    this.fileUrl = props.fileUrl;
    this.contentType = props.contentType;
    this.sizeBytes = props.sizeBytes;
    this.ownerUserId = props.ownerUserId;
    this.buildingId = props.buildingId;
    this.apartmentId = props.apartmentId;
    this.version = props.version;
    this.previousDocumentId = props.previousDocumentId;
  }

  static upload(
    tenantId: string,
    input: {
      category: DocumentCategory;
      title: string;
      fileUrl: string;
      contentType: string;
      sizeBytes?: number | null;
      ownerUserId: string;
      buildingId?: string | null;
      apartmentId?: string | null;
    },
    actorId: string | null,
  ): Document {
    invariant(input.title.trim().length > 0, 'DOCUMENT_TITLE', 'Title is required');
    invariant(/^https?:\/\//.test(input.fileUrl), 'DOCUMENT_URL', 'A valid file URL is required');
    return new Document({
      ...newEntityProps(newId(), tenantId, actorId),
      category: input.category,
      title: input.title.trim(),
      fileUrl: input.fileUrl,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes ?? null,
      ownerUserId: input.ownerUserId,
      buildingId: input.buildingId ?? null,
      apartmentId: input.apartmentId ?? null,
      version: 1,
      previousDocumentId: null,
    });
  }

  static restore(props: DocumentProps): Document {
    return new Document(props);
  }

  get title(): string {
    return this._title;
  }

  /** Create the next version as a new aggregate that chains to this one. */
  newVersion(
    input: { fileUrl: string; contentType: string; sizeBytes?: number | null; title?: string },
    actorId: string | null,
  ): Document {
    this.assertNotDeleted();
    invariant(/^https?:\/\//.test(input.fileUrl), 'DOCUMENT_URL', 'A valid file URL is required');
    return new Document({
      ...newEntityProps(newId(), this.tenantId, actorId),
      category: this.category,
      title: (input.title ?? this._title).trim(),
      fileUrl: input.fileUrl,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes ?? null,
      ownerUserId: this.ownerUserId,
      buildingId: this.buildingId,
      apartmentId: this.apartmentId,
      version: this.version + 1,
      previousDocumentId: this.id,
    });
  }

  rename(title: string, actorId: string | null): void {
    this.assertNotDeleted();
    invariant(title.trim().length > 0, 'DOCUMENT_TITLE', 'Title is required');
    this._title = title.trim();
    this.touch(actorId);
  }

  toProps(): DocumentProps {
    return {
      ...this.entityProps(),
      category: this.category,
      title: this._title,
      fileUrl: this.fileUrl,
      contentType: this.contentType,
      sizeBytes: this.sizeBytes,
      ownerUserId: this.ownerUserId,
      buildingId: this.buildingId,
      apartmentId: this.apartmentId,
      version: this.version,
      previousDocumentId: this.previousDocumentId,
    };
  }
}
