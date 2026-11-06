import assert from 'node:assert/strict'
import {expect} from '@playwright/test'

/** Only native sequential navigation and keyboard input may drive a measured flow. */
export async function keyboardControls(page){
 const trace=[]
 await page.evaluate(()=>{
  const state={pointer:[],focusCalls:0},original=HTMLElement.prototype.focus
  const pointer=event=>{if(event.type!=='click'||event.detail>0)state.pointer.push(event.type)}
  for(const type of ['pointerdown','mousedown','touchstart','click'])document.addEventListener(type,pointer,true)
  HTMLElement.prototype.focus=function(...args){state.focusCalls++;return original.apply(this,args)}
  window.keyboardProof={state,restore:()=>{
   HTMLElement.prototype.focus=original
   for(const type of ['pointerdown','mousedown','touchstart','click'])document.removeEventListener(type,pointer,true)
  }}
 })
 async function reach(control,label){
  await expect(control).toBeVisible()
  await expect(control).toBeEnabled()
  let tabs=0
  while(!await control.evaluate(element=>element===document.activeElement)){
   assert.ok(tabs<250,`Tab navigation reaches ${label}`)
   await page.keyboard.press('Tab');tabs++
  }
  await expect(control).toBeFocused()
  trace.push({control:label,tabs})
 }
 return {
  async type(control,value,label){await reach(control,label);await page.keyboard.type(value);await expect(control).toHaveValue(value)},
  async choose(control,value,label){
   await reach(control,label)
   const index=await control.evaluate((select,value)=>[...select.options].findIndex(option=>option.value===value),value)
   assert.ok(index>=0,`${label} has the intended choice`)
   await page.keyboard.press('Home')
   for(let step=0;step<index;step++)await page.keyboard.press('ArrowDown')
   await page.keyboard.press('Enter')
   await expect(control).toHaveValue(value)
  },
  async activate(control,label,key='Enter'){await reach(control,label);await page.keyboard.press(key)},
  async finish(){
   const input=await page.evaluate(()=>{const proof=window.keyboardProof;proof.restore();return proof.state})
   assert.deepEqual(input,{pointer:[],focusCalls:0},'no pointer input or programmatic focus shortcut in the measured flow')
   assert.ok(trace.some(step=>step.tabs>0),'the flow performs sequential focus navigation')
   return {trace,...input}
  },
 }
}
