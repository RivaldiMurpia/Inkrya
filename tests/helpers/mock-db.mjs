let implementation;
export function setDatabase(value){implementation=value}
export const db=new Proxy({}, {get(_target,key){return implementation[key]}});
