export interface EvidenceVersion {id:string;versionNumber:number;wording:string;editedByOperatorId:string|null;createdAt:string}
export interface EvidenceAttachment {id:string;filename:string;contentType:string;byteSize:number}
export interface EvidenceAttachments {files:EvidenceAttachment[];uploads:{id:string;filename:string;writing:number}[]}
export interface RequestSuggestion {showVoters?:boolean;id?:string;slug:string;title:string;description:string;matchedTerms:string[]}
