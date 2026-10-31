import { z } from "zod";
import { officialUrl } from "@/lib/imports/body";
export const ageRuleContract = z.object({
  label:z.string().min(1).max(300), version:z.string().min(1).max(100), discipline:z.enum(["short-track","long-track"]),
  season:z.string().regex(/^20\d{2}-20\d{2}$/), baselineDate:z.string().regex(/^20\d{2}-07-01$/), basis:z.enum(["before-july-1","as-of-july-1"]),
  source:z.object({url:z.string().max(2000).refine(officialUrl), sha256:z.string().regex(/^[a-f0-9]{64}$/).nullable(), pages:z.array(z.number().int().min(1).max(5000)).min(1).max(20)}).strict(),
  categories:z.record(z.string().min(1).max(80),z.object({min:z.number().int().min(0).max(120),max:z.number().int().min(0).max(120).nullable()}).strict()).refine(c=>Object.keys(c).length>0&&Object.keys(c).length<=100&&Object.values(c).every(v=>v.max===null||v.min<=v.max)),
  divisionCategories:z.record(z.string().min(1).max(100),z.object({min:z.number().int().min(0).max(120),max:z.number().int().min(0).max(120).nullable()}).strict()).refine(c=>Object.keys(c).length<=100&&Object.values(c).every(v=>v.max===null||v.min<=v.max)).optional(),
  rangeAnnotations:z.boolean(),
}).strict().refine(r=>Number(r.season.slice(5))===Number(r.season.slice(0,4))+1&&r.baselineDate===`${r.season.slice(0,4)}-07-01`,"The rule must identify its reviewed season baseline.");
export type AgeRule = z.infer<typeof ageRuleContract>;
export function categoryInterval(category:string|null,rule:AgeRule): {min:number;max:number|null}|null {
  if (!category) return null;
  const exact = Object.entries(rule.categories).find(([name])=>name.toLowerCase()===category.toLowerCase());
  if (exact) return exact[1];
  const range = rule.rangeAnnotations ? /^(?:Master )?[MW] (\d{2})-(\d{2})$/i.exec(category) : null;
  return range && Number(range[1])<=Number(range[2]) ? {min:Number(range[1]),max:Number(range[2])} : null;
}
