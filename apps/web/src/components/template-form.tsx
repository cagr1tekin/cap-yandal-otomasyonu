import { LABELS, type TrackType } from '@cap/contracts';
import { ActionForm, SubmitButton } from '@/components/forms';
import { Field, Input, Select } from '@/components/ui';
import { saveTemplateAction } from '@/lib/actions';
import type { Course, Program, Template } from '@/lib/types';

const SLOT_SEMESTERS = [5, 6, 7];
const BLANK_CONDITIONS = 3;

/**
 * Protokol şablonu düzenleme: müfredattan dersler, yarıyıl başına teknik seçmeli ders yeri sayısı,
 * ortak AKTS ve numaralı özel şartlar. Satır sırası kâğıt protokoldeki gibidir (yarıyıl, sonra seçmeliler).
 */
export function TemplateForm({ template, type, courses, programs, usedProgramIds }: { template?: Template; type: TrackType; courses: Course[]; programs: Program[]; usedProgramIds: string[] }) {
  const picked = new Set(template?.items.filter((i) => i.kind === 'COURSE').map((i) => i.code));
  const slots = (semester: number) => template?.items.filter((i) => i.kind === 'ELECTIVE_SLOT' && i.semester === semester).length ?? 0;
  const semesters = [...new Set(courses.map((c) => c.semester))].sort((a, b) => a - b);
  const next = Math.max(0, ...(template?.conditions.map((c) => c.no) ?? [])) + 1;
  const conditions = [
    ...(template?.conditions ?? []),
    ...Array.from({ length: BLANK_CONDITIONS }, (_, i) => ({ id: `yeni-${i}`, no: next + i, sourceCourseCode: '', sourceCourseName: '', targetCourseCode: '', note: null as string | null })),
  ];

  return (
    <ActionForm action={saveTemplateAction} className="space-y-5">
      {template && <input type="hidden" name="id" value={template.id} />}
      <input type="hidden" name="type" value={type} />
      <div className="grid gap-3 sm:grid-cols-3">
        {type === 'CAP' ? (
          <Field label="Ana dal bölümü" hint="Protokol bu bölümden gelen öğrenciler içindir">
            {template ? (
              <>
                <input type="hidden" name="sourceProgramId" value={template.sourceProgramId ?? ''} />
                <Input readOnly value={template.sourceProgram?.name ?? ''} />
              </>
            ) : (
              <Select name="sourceProgramId" required defaultValue="">
                <option value="" disabled>
                  Seçin
                </option>
                {programs
                  .filter((p) => !p.isHome && !usedProgramIds.includes(p.id))
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </Select>
            )}
          </Field>
        ) : (
          <input type="hidden" name="sourceProgramId" value="" />
        )}
        <Field label="Başlık">
          <Input name="title" required defaultValue={template?.title ?? (type === 'YANDAL' ? 'Bilgisayar Mühendisliği Yan Dal Ders Listesi' : '')} placeholder="… Mühendisliğinden Bilgisayar Mühendisliğine" />
        </Field>
        {type === 'CAP' ? (
          <Field label="Ortak AKTS" hint="Ana dalda alınan, iki programda ortak sayılan dersler (ÇAP Yön. m.7/2)">
            <Input name="commonEcts" type="number" min={0} max={240} required defaultValue={template?.commonEcts ?? 0} />
          </Field>
        ) : (
          <input type="hidden" name="commonEcts" value="0" />
        )}
      </div>

      <fieldset>
        <legend className="text-sm font-semibold uppercase tracking-wide text-su-muted">{type === 'CAP' ? 'Protokoldeki dersler' : `${LABELS.track[type]} ders listesi`}</legend>
        <p className="mb-2 text-xs text-su-muted">Bilgisayar Mühendisliği müfredatından (Bologna ders paketi) seçilir. Ana dalda ortak olan dersler protokole yazılmaz.</p>
        <div className="grid gap-4 lg:grid-cols-2">
          {semesters.map((sem) => (
            <div key={sem} className="rounded-lg border border-su-border/60 p-3">
              <p className="mb-1.5 text-sm font-medium text-su-heading">{sem}. yarıyıl</p>
              <div className="space-y-1 text-sm">
                {courses
                  .filter((c) => c.semester === sem && c.kind === 'ZORUNLU')
                  .map((c) => (
                    <label key={c.code} className="flex items-center gap-2">
                      <input type="checkbox" name="course" value={c.code} defaultChecked={picked.has(c.code)} />
                      <span className="font-mono text-xs">{c.code}</span> {c.name} <span className="text-xs text-su-subtle">{c.ects}</span>
                    </label>
                  ))}
              </div>
              {type === 'CAP' && SLOT_SEMESTERS.includes(sem) && (
                <label className="mt-2 flex items-center gap-2 border-t border-su-border/60 pt-2 text-sm">
                  <Input name={`slots:${sem}`} type="number" min={0} max={6} defaultValue={slots(sem)} className="w-20" />
                  adet {sem}. yarıyıl teknik seçmeli ders (4 AKTS)
                </label>
              )}
            </div>
          ))}
        </div>
      </fieldset>

      {type === 'CAP' && (
        <fieldset>
          <legend className="text-sm font-semibold uppercase tracking-wide text-su-muted">Özel şartlar</legend>
          <p className="mb-2 text-xs text-su-muted">“Öğrenci ana dal bölümünden … kodlu dersi alırsa … kodlu dersten muaf sayılacaktır.” Boş satır kaydedilmez; kayıtlı şart silinmez, güncellenir.</p>
          <div className="space-y-2">
            {conditions.map((c, i) => (
              <div key={c.id} className="grid gap-2 rounded-lg bg-su-bg p-2 sm:grid-cols-[4rem_8rem_1fr_8rem_1fr]">
                <Input name={`cond:no:${i}`} type="number" min={1} defaultValue={c.no} aria-label="Şart no" />
                <Input name={`cond:src:${i}`} defaultValue={c.sourceCourseCode} placeholder="Ana dal kodu" aria-label="Ana dal ders kodu" />
                <Input name={`cond:srcName:${i}`} defaultValue={c.sourceCourseName} placeholder="Ana dal dersinin adı" aria-label="Ana dal ders adı" />
                <Input name={`cond:target:${i}`} defaultValue={c.targetCourseCode} placeholder="Muaf ders kodu" aria-label="Muaf sayılacak ders kodu" list="courses" />
                <Input name={`cond:note:${i}`} defaultValue={c.note ?? ''} placeholder="Not (isteğe bağlı)" aria-label="Not" />
              </div>
            ))}
          </div>
          <datalist id="courses">
            {courses.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </datalist>
        </fieldset>
      )}
      <SubmitButton>{template ? 'Şablonu kaydet' : 'Şablonu oluştur'}</SubmitButton>
    </ActionForm>
  );
}
