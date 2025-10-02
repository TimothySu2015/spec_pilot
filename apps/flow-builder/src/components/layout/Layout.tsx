import { useState, useRef, useEffect } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import MainContent from './MainContent';
import RightPanel from './RightPanel';

export default function Layout() {
  const [leftWidth, setLeftWidth] = useState(240);
  const [rightWidth, setRightWidth] = useState(320);
  const [isDraggingLeft, setIsDraggingLeft] = useState(false);
  const [isDraggingRight, setIsDraggingRight] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 左側分隔線拖拉
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingLeft && containerRef.current) {
        const containerLeft = containerRef.current.getBoundingClientRect().left;
        const newWidth = e.clientX - containerLeft;
        if (newWidth >= 200 && newWidth <= 400) {
          setLeftWidth(newWidth);
        }
      }
    };

    const handleMouseUp = () => {
      setIsDraggingLeft(false);
    };

    if (isDraggingLeft) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingLeft]);

  // 右側分隔線拖拉
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingRight && containerRef.current) {
        const containerRight = containerRef.current.getBoundingClientRect().right;
        const newWidth = containerRight - e.clientX;
        if (newWidth >= 280 && newWidth <= 600) {
          setRightWidth(newWidth);
        }
      }
    };

    const handleMouseUp = () => {
      setIsDraggingRight(false);
    };

    if (isDraggingRight) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingRight]);

  return (
    <div className="flex flex-col h-screen">
      {/* Header - 64px */}
      <Header />

      {/* Main content area */}
      <div ref={containerRef} className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - resizable */}
        <div style={{ width: `${leftWidth}px` }} className="bg-white border-r border-gray-200 overflow-y-auto flex-shrink-0">
          <Sidebar />
        </div>

        {/* Left Resize Handle */}
        <div
          className={`w-1 bg-gray-200 hover:bg-primary cursor-col-resize transition-colors ${
            isDraggingLeft ? 'bg-primary' : ''
          }`}
          onMouseDown={() => setIsDraggingLeft(true)}
        />

        {/* Center content - flexible */}
        <MainContent />

        {/* Right Resize Handle */}
        <div
          className={`w-1 bg-gray-200 hover:bg-primary cursor-col-resize transition-colors ${
            isDraggingRight ? 'bg-primary' : ''
          }`}
          onMouseDown={() => setIsDraggingRight(true)}
        />

        {/* Right Panel - resizable */}
        <div style={{ width: `${rightWidth}px` }} className="bg-white border-l border-gray-200 overflow-hidden flex flex-col flex-shrink-0">
          <RightPanel />
        </div>
      </div>
    </div>
  );
}
