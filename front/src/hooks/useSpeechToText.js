import { useCallback, useEffect, useRef, useState } from "react";

// Chrome and Edge still only expose the prefixed constructor; Safari exposes it
// prefixed too, with its own quirks. Firefox exposes neither, which is why every
// caller has to handle `isSupported` being false rather than treating dictation
// as always available. Read once at module scope: the API is either on `window`
// at load or it never is, and a secure context is a page-level property.
const SpeechRecognition =
  typeof window === "undefined"
    ? null
    : window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;

/**
 * Live dictation over the browser's native SpeechRecognition.
 *
 * Runs in continuous + interim mode, and splits the two kinds of result the API
 * emits: a *final* transcript is handed to `onFinalResult` for the caller to
 * commit, while in-progress text is only ever exposed as `interimTranscript` for
 * preview. That split is the point of the hook — interim results are rewritten
 * as the recogniser hears more, so inserting them would put words into the
 * document that the user never said.
 *
 * Errors are reported through `onError` rather than read off the returned
 * `error` state, because the codes repeat: two `no-speech` events in a row set
 * the same value, so an effect watching it would fire once. `error` is kept for
 * rendering the current condition; the callback is for reacting to it.
 *
 * Returns `isSupported`, `isListening`, `interimTranscript`, `error` (the raw
 * `event.error` code, e.g. "not-allowed" / "no-speech" / "network"), plus
 * `start` and `stop`.
 */
export default function useSpeechToText({ onFinalResult, onError } = {}) {
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState(null);

  // The live instance, so `stop()` can reach it without it being state — a
  // recogniser in state would re-render the whole editor on every start/stop.
  const recognitionRef = useRef(null);

  // Call sites pass inline closures, so the handlers read them through refs.
  // Wiring them directly would mean tearing down and re-attaching recognition
  // every time the parent re-renders, which drops audio mid-sentence.
  const onFinalResultRef = useRef(onFinalResult);
  onFinalResultRef.current = onFinalResult;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const stop = useCallback(() => {
    // `stop()` rather than `abort()`: it flushes whatever the recogniser is
    // still holding as a final result, so the last word before the click is not
    // thrown away. `onend` is what actually clears the listening state.
    recognitionRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    if (!SpeechRecognition) return;
    // Calling `start()` on an already-started instance throws
    // InvalidStateError, and the caller toggling faster than `onend` arrives is
    // a normal thing for a user to do.
    if (recognitionRef.current) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    // Hardcoded for this pass; a language picker is deliberately out of scope.
    recognition.lang = "en-US";

    // Every handler checks that this is still the current instance. A stopped
    // recogniser can emit its last events after a new one has been created, and
    // without the guard that trailing `onend` would switch the UI back off
    // while the replacement is genuinely listening.
    const isCurrent = () => recognitionRef.current === recognition;

    recognition.onstart = () => {
      if (!isCurrent()) return;
      setError(null);
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      if (!isCurrent()) return;
      // Only entries from `resultIndex` on are new; in continuous mode
      // `event.results` keeps growing and re-reading it from 0 would re-commit
      // every sentence already inserted.
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const transcript = result[0]?.transcript ?? "";
        if (result.isFinal) {
          onFinalResultRef.current?.(transcript);
        } else {
          interim += transcript;
        }
      }
      // Set unconditionally: an event carrying only finals means the pending
      // phrase was just committed, and the preview has to empty with it.
      setInterimTranscript(interim);
    };

    recognition.onerror = (event) => {
      if (!isCurrent()) return;
      setError(event.error);
      onErrorRef.current?.(event.error);
      // `onend` still fires after most errors and does the state reset, but not
      // reliably for every code, so the interim preview is cleared here too.
      setInterimTranscript("");
    };

    recognition.onend = () => {
      if (!isCurrent()) return;
      // Also the path for recognition ending on its own — Chrome stops after a
      // stretch of silence even in continuous mode — so this is what keeps the
      // button from being stuck in its listening state with no live recogniser.
      recognitionRef.current = null;
      setIsListening(false);
      setInterimTranscript("");
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (err) {
      // Only reachable if the instance was somehow already running; the
      // permission prompt and every runtime failure arrive through `onerror`.
      console.error("Error starting speech recognition:", err);
      recognitionRef.current = null;
      setIsListening(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      const recognition = recognitionRef.current;
      if (!recognition) return;
      recognitionRef.current = null;
      // Detach before aborting: the handlers close over `setState`, and under
      // StrictMode's double mount the teardown runs while the component is
      // gone. `abort()` rather than `stop()` — there is no editor left to
      // receive a final transcript, so flushing one would be pointless work.
      recognition.onstart = null;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.abort();
    };
  }, []);

  return {
    isSupported: Boolean(SpeechRecognition),
    isListening,
    interimTranscript,
    error,
    start,
    stop,
  };
}
