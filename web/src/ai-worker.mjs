import { chooseAction } from "./ai.mjs";
self.onmessage = ({ data }) => {
  try {
    self.postMessage({
      id: data.id,
      ...chooseAction(data.state, data.difficulty),
    });
  } catch (error) {
    self.postMessage({ id: data.id, error: error.message });
  }
};
