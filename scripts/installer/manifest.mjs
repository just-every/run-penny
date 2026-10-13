import branding from '../../src/branding.json' with {type:'json'}
import {readFileSync} from 'node:fs'
import {readSetupManifestBytes,createInstallerModel} from '../base-onboarding/setup-manifest.mjs'
import * as presentation from './ui/seed.mjs'
export const manifest=readSetupManifestBytes(readFileSync(new URL('../../rer-setup.json',import.meta.url)),readFileSync(new URL('../base-onboarding/schema/SETUP.schema.json',import.meta.url)))
export const model=createInstallerModel(manifest,{...presentation,product:{...presentation.product,name:branding.name}},{ownerBootstrap:true})
