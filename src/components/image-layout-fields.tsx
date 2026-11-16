"use client";
import type { ImageLayout } from "@/lib/image-layout";
import { useLocale } from "./locale-provider";

export function ImageLayoutFields({ value = {}, disabled, onChange }: { value?: ImageLayout; disabled: boolean; onChange: (value: ImageLayout) => void }) {
  const { t } = useLocale();
  const change = (patch: Partial<ImageLayout>) => onChange({ ...value, ...patch });
  const field = "mt-1 block w-full min-w-0 rounded-lg border border-border bg-white px-2 py-2 text-xs";
  return <fieldset disabled={disabled} className="mt-3 space-y-3">
    <legend className="text-xs font-medium">{t("image_layout.title")}</legend>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <label className="text-xs">{t("image_layout.position")}<select className={field} value={value.placement ?? "after"} onChange={event => change({placement:event.target.value as ImageLayout['placement']})}>
        {(["before","after","start","end"] as const).map(position => <option key={position} value={position}>{t(`image_layout.${position}`)}</option>)}
      </select></label>
      <label className="text-xs">{t("image_layout.align")}<select className={field} value={value.align ?? "center"} onChange={event => change({align:event.target.value as ImageLayout['align']})}>
        {(["left","center","right"] as const).map(align => <option key={align} value={align}>{t(`image_layout.${align}`)}</option>)}
      </select></label>
    </div>
    <label className="block text-xs">{t("image_layout.width")}<input type="number" min={80} max={552} value={value.width ?? 552} className={field} onChange={event => change({width:Number(event.target.value)})} /></label>
    <label className="block text-xs">{t("image_layout.above")}<textarea rows={2} maxLength={2000} value={value.beforeText ?? ""} className={field} onChange={event => change({beforeText:event.target.value})} /></label>
    <label className="block text-xs">{t("image_layout.below")}<textarea rows={2} maxLength={2000} value={value.afterText ?? ""} className={field} onChange={event => change({afterText:event.target.value})} /></label>
    <label className="block text-xs">{t("image_layout.link")}<input type="url" maxLength={2000} placeholder="https://" value={value.link ?? ""} className={field} onChange={event => change({link:event.target.value})} /></label>
  </fieldset>;
}
