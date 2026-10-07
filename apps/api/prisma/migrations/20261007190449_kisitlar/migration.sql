-- Denetim kaydı değiştirilemez ve silinemez (teknik doküman 6.2).
CREATE OR REPLACE FUNCTION audit_log_readonly() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog kayıtları değiştirilemez veya silinemez';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_no_update BEFORE UPDATE OR DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION audit_log_readonly();

-- KR-ÇAP-06 / KR-YD-04: bir öğrencinin aynı türde en fazla bir etkin (veya dondurulmuş) kaydı olabilir.
CREATE UNIQUE INDEX "Enrollment_one_active_per_type"
  ON "Enrollment" ("studentNo", "type")
  WHERE "status" IN ('ACTIVE', 'FROZEN');

-- Kontenjan ve sayılar negatif olamaz.
ALTER TABLE "Offering" ADD CONSTRAINT "Offering_quota_positive" CHECK ("quota" > 0);
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_strikes_nonneg" CHECK ("ganoStrikes" >= 0);
