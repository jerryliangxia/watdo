"use client";

import { Drawer } from "vaul";
import styles from "../../styles/components/components.module.css";
import Graph from "./Graph";

export default function Changelog() {
  return (
    <Drawer.Root
      shouldScaleBackground={false}
      direction="right"
      // @ts-ignore - direction prop is supported in the latest version
    >
      <Drawer.Trigger asChild>
        <div className="link" data-trigger="changelog">
          Changelog
        </div>
      </Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Overlay className={styles.overlay} />
        <Drawer.Content className={`${styles.drawer} ${styles.changelog}`}>
          <Drawer.Title className="sr-only">Changelog</Drawer.Title>
          <div className={styles.content}>
            <Graph />
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
