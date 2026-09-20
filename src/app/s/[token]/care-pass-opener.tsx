"use client";

import { useEffect, useRef } from "react";
import { openCarePassAction } from "@/modules/care/presentation/actions";

/** Records the opening (audit + use count) once per device session. */
export function CarePassOpener({ token }: { token: string }) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    void openCarePassAction(token);
  }, [token]);
  return null;
}
