"use client";

import { useEffect } from "react";

/**
 * DOMSafetyPatch
 * 
 * Safely guards React's DOM reconciliation against third-party DOM modifications
 * (such as Google OAuth GSI scripts, browser extensions, Grammarly, or Google Translate)
 * that alter or re-parent DOM nodes managed by React.
 * 
 * Prevents "NotFoundError: Failed to execute 'removeChild' on 'Node'" crashes during component unmounting.
 */
export default function DOMSafetyPatch() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const originalRemoveChild = Node.prototype.removeChild;
    Node.prototype.removeChild = function <T extends Node>(child: T): T {
      if (child && child.parentNode !== this) {
        if (child.parentNode) {
          return child.parentNode.removeChild(child) as T;
        }
        return child;
      }
      return originalRemoveChild.call(this, child) as T;
    };

    const originalInsertBefore = Node.prototype.insertBefore;
    Node.prototype.insertBefore = function <T extends Node>(newNode: T, referenceNode: Node | null): T {
      if (referenceNode && referenceNode.parentNode !== this) {
        if (referenceNode.parentNode) {
          return referenceNode.parentNode.insertBefore(newNode, referenceNode) as T;
        }
        return this.appendChild(newNode) as T;
      }
      return originalInsertBefore.call(this, newNode, referenceNode) as T;
    };
  }, []);

  return null;
}
