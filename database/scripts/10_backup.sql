/* ============================================================
   3martna (عمارتنا) — Backup & Restore
   Schedule: full nightly, differential every 6h, log every 15m
   (via SQL Server Agent or an external scheduler).
   ============================================================ */
USE master;
GO

/* -------- Full backup -------- */
DECLARE @FullPath NVARCHAR(400) =
    N'/var/opt/mssql/backups/Amartna_FULL_' +
    FORMAT(SYSUTCDATETIME(), 'yyyyMMdd_HHmmss') + N'.bak';
BACKUP DATABASE Amartna
TO DISK = @FullPath
WITH COMPRESSION, CHECKSUM, INIT,
     NAME = N'Amartna Full Backup';
GO

/* -------- Differential backup (uncomment to use) --------
DECLARE @DiffPath NVARCHAR(400) =
    N'/var/opt/mssql/backups/Amartna_DIFF_' +
    FORMAT(SYSUTCDATETIME(), 'yyyyMMdd_HHmmss') + N'.bak';
BACKUP DATABASE Amartna
TO DISK = @DiffPath
WITH DIFFERENTIAL, COMPRESSION, CHECKSUM,
     NAME = N'Amartna Differential Backup';
GO
*/

/* -------- Transaction log backup (uncomment to use) --------
DECLARE @LogPath NVARCHAR(400) =
    N'/var/opt/mssql/backups/Amartna_LOG_' +
    FORMAT(SYSUTCDATETIME(), 'yyyyMMdd_HHmmss') + N'.trn';
BACKUP LOG Amartna
TO DISK = @LogPath
WITH COMPRESSION, CHECKSUM,
     NAME = N'Amartna Log Backup';
GO
*/

/* -------- Restore (example) --------
USE master;
ALTER DATABASE Amartna SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
RESTORE DATABASE Amartna
FROM DISK = N'/var/opt/mssql/backups/Amartna_FULL_20260713_020000.bak'
WITH REPLACE, RECOVERY;
ALTER DATABASE Amartna SET MULTI_USER;
GO
*/

/* -------- Verify latest backup --------
RESTORE VERIFYONLY
FROM DISK = N'/var/opt/mssql/backups/Amartna_FULL_20260713_020000.bak'
WITH CHECKSUM;
GO
*/
