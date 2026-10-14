/** Compare every pre-v9 byte of a legacy record while separately testing new hidden fields. */
export function preRiskRecord<T>(value:T):T {
 const copy=structuredClone(value);
 function visit(v:unknown){if(!v||typeof v!=='object')return;
  const record=v as Record<string,unknown>;delete record.healthGenome;delete record.riskModel;
  for(const child of Object.values(record))visit(child);
 }
 visit(copy);return copy;
}
