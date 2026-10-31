import {createFileRoute} from '@tanstack/react-router'
import {AskPanel} from '@/core/features/ai/ui/ask-panel'
export const Route=createFileRoute('/app/ask')({
 validateSearch:(search:Record<string,unknown>):{answer?:string}=>({answer:typeof search.answer==='string'&&/^[0-9a-f-]{36}$/.test(search.answer)?search.answer:undefined}),
 component:AskPage,
})
function AskPage(){const {answer}=Route.useSearch();return <AskPanel answerId={answer}/>}
