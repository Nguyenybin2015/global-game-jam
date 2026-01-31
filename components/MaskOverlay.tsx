import React from "react";
import { MaskType } from "../types";

interface Props {
  mask: MaskType;
}

const MaskOverlay: React.FC<Props> = ({ mask }) => {
  if (mask === MaskType.NONE) return null;
  return (
    <div
      className='absolute inset-0 pointer-events-none z-0 transition-opacity duration-1000'
      aria-hidden
    />
  );
};

export default MaskOverlay;
