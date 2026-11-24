import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import { Modal } from "@/components/Modal";
import { FormError } from "@/components/FeedbackBanner";
import { TagInput } from "@/components/TagInput";
import {
  fieldErrorClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui";
import { getErrorMessage, getFieldErrors } from "@/lib/apiError";
import util from "@/lib/util.json";
import { skillSchema, type SkillFormData } from "../schemas/skillSchema";
import { createSkill, updateSkill } from "../services/skillService";
import {
  ACTIVITY_TYPES,
  EXPERIENCE_LEVELS,
  type ActivityType,
  type ExperienceLevel,
  type Skill,
} from "../types";

const t = util.skills.form;

const API_FIELD_TO_FORM: Record<string, keyof SkillFormData> = {
  tecnologias: "technologies",
  tipoAtividade: "activityType",
  nivelExperiencia: "level",
};

export function SkillFormModal({
  userId,
  skill,
  onClose,
  onSaved,
}: {
  userId: number;
  skill?: Skill;
  onClose: () => void;
  onSaved: (skill: Skill, mode: "created" | "updated") => void;
}) {
  const isEdit = Boolean(skill);
  const [serverError, setServerError] = useState("");
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SkillFormData>({
    resolver: zodResolver(skillSchema),
    defaultValues: {
      technologies: skill?.technologies ?? [],
      activityType: skill?.activityType ?? "",
      level: skill?.level ?? "",
    },
  });

  const onSubmit = async (data: SkillFormData) => {
    setServerError("");
    const input = {
      technologies: data.technologies,
      activityType: data.activityType as ActivityType,
      level: data.level as ExperienceLevel,
    };
    try {
      const saved = skill
        ? await updateSkill(userId, skill.id, input)
        : await createSkill(userId, input);
      onSaved(saved, isEdit ? "updated" : "created");
    } catch (error) {
      for (const [apiField, message] of Object.entries(getFieldErrors(error))) {
        const field = API_FIELD_TO_FORM[apiField];
        if (field) setError(field, { message });
      }
      setServerError(getErrorMessage(error, t.saveError));
    }
  };

  return (
    <Modal title={isEdit ? t.editTitle : t.createTitle} onClose={isSubmitting ? () => {} : onClose}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
        <FormError message={serverError} />

        <Controller
          control={control}
          name="technologies"
          render={({ field, fieldState }) => (
            <TagInput
              label={t.technologies}
              value={field.value}
              onChange={field.onChange}
              placeholder={t.technologiesPlaceholder}
              error={fieldState.error?.message}
            />
          )}
        />

        <div className="grid gap-5 sm:grid-cols-2">
          <label className={labelClass}>
            {t.activityType}
            <select
              {...register("activityType")}
              aria-invalid={Boolean(errors.activityType)}
              className={`${inputClass} h-11`}
            >
              <option value="">{t.select}</option>
              {ACTIVITY_TYPES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {errors.activityType && <span className={fieldErrorClass}>{errors.activityType.message}</span>}
          </label>

          <label className={labelClass}>
            {t.level}
            <select {...register("level")} aria-invalid={Boolean(errors.level)} className={`${inputClass} h-11`}>
              <option value="">{t.select}</option>
              {EXPERIENCE_LEVELS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {errors.level && <span className={fieldErrorClass}>{errors.level.message}</span>}
          </label>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={isSubmitting} className={secondaryButtonClass}>
            {util.common.cancel}
          </button>
          <button type="submit" disabled={isSubmitting} className={primaryButtonClass}>
            {isSubmitting && <LoaderCircle className="size-4 animate-spin" />}
            {isSubmitting ? t.saving : isEdit ? t.save : t.create}
          </button>
        </div>
      </form>
    </Modal>
  );
}
