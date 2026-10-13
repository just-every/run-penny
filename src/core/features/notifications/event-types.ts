export interface DeliveryEvent {
 provider:'sendgrid'|'resend';tenantId:string;eventNamespace:string;eventId:string;providerMessageId:string
 type:string;status:string|null;occurredAt:number;recipients:string[];deliveryId:string|null;product:string|null;fingerprint:string
}
export interface EventAuthorization {
 event:DeliveryEvent;addressId:string;batchId:string|null;outboxId?:string;attemptId:string;suppress:boolean
 witness:{sql:string;values:(string|number|null)[];raw:string}
}
export interface EventTransaction {get(key:string):Promise<unknown>;put(key:string,value:unknown):Promise<void>}
