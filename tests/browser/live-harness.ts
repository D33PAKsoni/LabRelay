import { Client, Realtime } from 'appwrite';
export async function probe(endpoint:string,project:string,jwt:string,channels:string[]) {
  const realtime=new Realtime(new Client().setEndpoint(endpoint).setProject(project).setJWT(jwt));
  const events:{id:string;keys:string[]}[]=[];
  await realtime.subscribe(channels,event=>events.push({id:event.payload.$id,keys:Object.keys(event.payload).filter(key=>!key.startsWith('$')).sort()}));
  return {events,close:()=>realtime.disconnect()};
}
