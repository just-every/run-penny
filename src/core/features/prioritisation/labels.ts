export const weightLabels={reach:'Reach',votes:'Voters',accounts:'Accounts',evidence:'Evidence',importance1:'Importance level 1',importance2:'Importance level 2',importance3:'Importance level 3',importance4:'Importance level 4',impact:'Impact',confidence:'Confidence (%)',effort:'Effort'} as const
export const manualLabels={impact:'Impact (0–10)',confidence:'Confidence (%)',effort:'Manual effort',value:'Manual value',segmentDemand:'Manual segment demand'} as const
export const inputLabels={...weightLabels,...manualLabels}
