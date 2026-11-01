// Coalesce transaction fanout and serialize authorized refreshes. A periodic read recovers missed signals.
export function refreshLoop(refresh:()=>Promise<void>, debounceMs=200, fallbackMs=30000) {
  let disposed=false, running=false, dirty=false;
  let timer:ReturnType<typeof setTimeout>|undefined;
  const run=async()=>{
    timer=undefined;if(disposed)return;if(running){dirty=true;return;}
    running=true;try{await refresh();}catch{/* UI owns its error state; the next signal/interval retries. */}
    finally{running=false;if(dirty&&!disposed){dirty=false;notify();}}
  };
  const notify=()=>{if(disposed)return;if(running){dirty=true;return;}if(timer===undefined)timer=setTimeout(()=>void run(),debounceMs);};
  const fallback=setInterval(notify,fallbackMs);
  return {notify,dispose(){disposed=true;dirty=false;clearInterval(fallback);if(timer!==undefined)clearTimeout(timer);}};
}
