"use client";

import dynamic from "next/dynamic";
import StaticContentBlock from "./StaticContentBlock";

type Props = {
  contentKey: string;
  isEditor: boolean;
  placeholder?: string;
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
      />
    );
  }

  return <LazyEditableBlock {...props} />;
}
