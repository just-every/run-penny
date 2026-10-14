import branding from '../../src/branding.json' with {type:'json'}
import {readFileSync} from 'node:fs'
import {readSetupManifestBytes,createInstallerModel} from '@runeditrun/rer/setup-manifest'
import * as presentation from './ui/seed.mjs'
export const manifest=readSetupManifestBytes(readFileSync(new URL('../../rer-setup.json',import.meta.url)),readFileSync(new URL(import.meta.resolve('@runeditrun/rer/setup-schema'))))
export const model=createInstallerModel(manifest,{...presentation,product:{...presentation.product,name:branding.name}},{ownerBootstrap:true})
