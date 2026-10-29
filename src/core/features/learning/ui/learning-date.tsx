import { formatDay, formatMoment } from '@/core/app/ui/operator-format'

/** Everyday metadata in the app's one short date style; exact source values stay in inspection. */
export function LearningDate({value,empty='Not established',dateOnly=false}:{value:string|null;empty?:string;dateOnly?:boolean}) {
 if(!value)return <>{empty}</>
 return <time dateTime={value}>{dateOnly?formatDay(value):formatMoment(value)}</time>
}
