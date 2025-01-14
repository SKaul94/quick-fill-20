class BrownNoiseProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [{
      name: "gain",
      defaultValue: 0.5,
      minValue: 0,
      maxValue: 1
    }];
  }

  constructor() {
    super();
    this.brown = 0; // Accumulator should be a member of the class
  }

  process(inputs, outputs, parameters) {
    const gain = parameters.gain[0];
    const output = outputs[0];
    const limit = 2; // Adjust this limit as needed

    output.forEach( channel  => {
      for (let i = 0; i < channel.length; i++) {
        const random = Math.random();
        const white = random * 2 - 1;  // white noise
        this.brown += 0.02 * white; // brown noise, ca. 6db per octave

        // Smooth Clipping
        if (this.brown > limit) {
          this.brown = limit;
        } else if (this.brown < -limit) {
          this.brown = -limit;
        }

        const result = this.brown * gain;
        channel[i] = result;
      }
    });
    return true;
  }
}

registerProcessor('brown-noise', BrownNoiseProcessor);