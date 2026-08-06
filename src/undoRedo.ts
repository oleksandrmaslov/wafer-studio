// Modified by Oleksandr Maslov for Wafer Studio, 2026.
// Based on ZMK Studio, licensed under Apache-2.0.
// SPDX-License-Identifier: Apache-2.0

import { createContext, useCallback, useMemo, useState } from "react";

export type UndoCallback = () => Promise<void>;

export type DoCallback = () => Promise<UndoCallback>;

export function useUndoRedo(): [
  (dc: DoCallback) => Promise<void>,
  () => Promise<void>,
  () => Promise<void>,
  boolean,
  boolean,
  () => void,
] {
  const [locked, setLocked] = useState<boolean>(false);
  const [undoStack, setUndoStack] = useState<Array<[DoCallback, UndoCallback]>>(
    [],
  );
  const [redoStack, setRedoStack] = useState<Array<DoCallback>>([]);

  const canUndo = useMemo(
    () => !locked && undoStack.length > 0,
    [locked, undoStack],
  );
  const canRedo = useMemo(
    () => !locked && redoStack.length > 0,
    [locked, redoStack],
  );

  const doIt = async (doCb: DoCallback, preserveRedo?: boolean) => {
    if (locked) {
      throw new Error("operation invoked when existing operation in progress");
    }

    setLocked(true);
    try {
      const undo = await doCb();

      setUndoStack((current) => [[doCb, undo], ...current]);
      if (!preserveRedo) {
        setRedoStack([]);
      }
    } finally {
      setLocked(false);
    }
  };

  const undo = async () => {
    if (locked) {
      throw new Error("undo invoked when existing operation in progress");
    }

    if (undoStack.length === 0) {
      throw new Error("undo invoked with no operations to undo");
    }

    setLocked(true);
    const [doCb, undoCb] = undoStack[0];
    setUndoStack(undoStack.slice(1));
    setRedoStack([doCb, ...redoStack]);

    try {
      await undoCb();
    } finally {
      setLocked(false);
    }
  };

  const redo = async () => {
    if (locked) {
      throw new Error("redo invoked when existing operation in progress");
    }

    if (redoStack.length === 0) {
      throw new Error("redo invoked with no operations to redo");
    }

    const doCb = redoStack[0];

    setRedoStack(redoStack.slice(1));

    return await doIt(doCb, true);
  };

  const reset = useCallback(() => {
    setRedoStack([]);
    setUndoStack([]);
  }, []);

  return [doIt, undo, redo, canUndo, canRedo, reset];
}

export const UndoRedoContext = createContext<
  ((dc: DoCallback) => Promise<void>) | null
>(null);
