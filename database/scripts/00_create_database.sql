/* ============================================================
   3martna (عمارتنا) — Database creation
   Target: Microsoft SQL Server 2019+
   ============================================================ */
IF DB_ID(N'Amartna') IS NULL
BEGIN
    CREATE DATABASE Amartna;
END
GO

ALTER DATABASE Amartna SET RECOVERY FULL;
GO
ALTER DATABASE Amartna SET READ_COMMITTED_SNAPSHOT ON WITH ROLLBACK IMMEDIATE;
GO

USE Amartna;
GO

PRINT 'Database Amartna ready.';
GO
