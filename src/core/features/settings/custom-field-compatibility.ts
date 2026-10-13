import type { CustomFieldType } from './custom-field-types'

// SQL length(text) stops at NUL and counts Unicode code points, whereas the
// value API limits UTF-16 code units. Walk UTF-8 only for strings whose byte
// length cannot already decide the result; stop as soon as the limit is crossed.
const textFits = `(WITH decoded(value) AS MATERIALIZED (SELECT CAST(json_extract(v.value_json,'$') AS BLOB))
  SELECT CASE WHEN length(value)<=20000 THEN 1 WHEN length(value)>60000 THEN 0
    ELSE (WITH RECURSIVE units(offset,count) AS (
      VALUES(1,0)
      UNION ALL
      SELECT offset + CASE
        WHEN hex(substr(value,offset,1)) >= 'F0' THEN 4
        WHEN hex(substr(value,offset,1)) >= 'E0' THEN 3
        WHEN hex(substr(value,offset,1)) >= 'C0' THEN 2 ELSE 1 END,
        count + CASE WHEN hex(substr(value,offset,1)) >= 'F0' THEN 2 ELSE 1 END
      FROM units WHERE offset<=length(value) AND count<=20000
    ) SELECT NOT EXISTS(SELECT 1 FROM units WHERE count>20000)) END FROM decoded)`

const calendarDate = `(SELECT
  length(CAST(value AS BLOB))=10 AND value GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
  AND CAST(substr(value,1,4) AS INTEGER) BETWEEN 1 AND 9999
  AND CAST(substr(value,6,2) AS INTEGER) BETWEEN 1 AND 12
  AND CAST(substr(value,9,2) AS INTEGER) BETWEEN 1 AND CASE CAST(substr(value,6,2) AS INTEGER)
    WHEN 2 THEN 28 + (CAST(substr(value,1,4) AS INTEGER)%4=0
      AND (CAST(substr(value,1,4) AS INTEGER)%100<>0 OR CAST(substr(value,1,4) AS INTEGER)%400=0))
    WHEN 4 THEN 30 WHEN 6 THEN 30 WHEN 9 THEN 30 WHEN 11 THEN 30 ELSE 31 END
  FROM (SELECT json_extract(v.value_json,'$') AS value))`

/** A scalar predicate for one stored value, evaluated inside the committing UPDATE. */
export function customFieldValueCompatibilitySql(type: CustomFieldType): string {
  const typed = {
    text: `json_type(v.value_json)='text' AND ${textFits}`,
    number: `json_type(v.value_json) IN ('integer','real')
      AND json_extract(v.value_json,'$') BETWEEN -1.7976931348623157e308 AND 1.7976931348623157e308`,
    boolean: `json_type(v.value_json) IN ('true','false')`,
    date: `json_type(v.value_json)='text' AND ${calendarDate}`,
  }[type]
  // CASE guarantees malformed JSON never reaches a JSON extractor. Raw NUL is
  // invalid JSON even on SQLite versions whose JSON parser treats it as EOF.
  return `CASE WHEN typeof(v.value_json)<>'text' OR instr(v.value_json,char(0))>0 OR NOT json_valid(v.value_json) THEN 0
    WHEN json_type(v.value_json)='null' THEN 1 ELSE (${typed}) END`
}
