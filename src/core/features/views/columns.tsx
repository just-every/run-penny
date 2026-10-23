import {createContext,useContext} from 'react'
export const ViewColumns=createContext<readonly string[]|undefined>(undefined)
export function useViewColumn(name:string){const columns=useContext(ViewColumns);return !columns||columns.includes(name)}
