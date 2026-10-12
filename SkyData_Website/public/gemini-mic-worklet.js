class SkyDataMicrophone extends AudioWorkletProcessor {
 constructor(){super();this.samples=new Float32Array(2048);this.offset=0;}
 process(inputs,outputs){const input=inputs[0]?.[0];if(input){for(const sample of input){this.samples[this.offset++]=sample;if(this.offset===this.samples.length){this.port.postMessage(this.samples,[this.samples.buffer]);this.samples=new Float32Array(2048);this.offset=0;}}}for(const output of outputs)for(const channel of output)channel.fill(0);return true;}
}
registerProcessor('skydata-microphone',SkyDataMicrophone);
