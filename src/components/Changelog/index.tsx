"use client";

import { Drawer } from "vaul";
import styles from "../../styles/components/components.module.css";
import Graph from "./Graph";

// Define extended props type that includes the direction property
interface ExtendedDrawerRootProps {
  shouldScaleBackground: boolean;
  direction: "right" | "left" | "top" | "bottom";
  children: React.ReactNode;
}

export default function Changelog() {
  return (
    <Drawer.Root
      shouldScaleBackground={false}
      direction="right"
      {...({} as Partial<ExtendedDrawerRootProps>)}
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
