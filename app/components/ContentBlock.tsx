"use client";

import dynamic from "next/dynamic";
import StaticContentBlock from "./StaticContentBlock";

type Props = {
  contentKey: string;
  isEditor: boolean;
  placeholder?: string;
  initialValue?: unknown;
};

const LazyEditableBlock = dynamic(() => import("./EditableBlock"), {
  ssr: false,
});

export default function ContentBlock(props: Props) {
  if (!props.isEditor) {
    return (
      <StaticContentBlock
        contentKey={props.contentKey}
        placeholder={props.placeholder}
        initialValue={props.initialValue}
      />
    );
  }

  return <LazyEditableBlock {...props} />;
}
