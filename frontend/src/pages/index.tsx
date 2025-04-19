import React, { useState, useEffect, useRef } from 'react';
import DocumentViewer from '../components/DocumentViewer';
import {
  Box,
  Typography,
  IconButton,
  Paper,
  TextField,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Button,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import { ThumbUp, ThumbDown, Comment, GTranslate } from '@mui/icons-material';

interface TextFeedbackMap {
  [key: string]: 'up' | 'down' | null;
}

interface CommentsMap {
  [key: string]: string;
}

const HomePage = () => {
  const [textFeedbackMap, setTextFeedbackMap] = useState<TextFeedbackMap>({});
  const [commentsMap, setCommentsMap] = useState<CommentsMap>({});
  const [selectionText, setSelectionText] = useState('');
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [justification, setJustification] = useState('');
  const [comment, setComment] = useState('');
  const [isCommenting, setIsCommenting] = useState(false);
  const [isJustifying, setIsJustifying] = useState(false);
  const commentBoxRef = useRef<HTMLDivElement>(null);
  const documentViewerRef = useRef<HTMLDivElement>(null);

  // Fetch initial feedback from backend
  useEffect(() => {
    const fetchInitialFeedback = async () => {
      try {
        const response = await fetch('http://127.0.0.1:8000/api/feedback/');
        if (!response.ok) {
          console.error('Failed to fetch initial feedback:', response.status);
          return;
        }
        const data = await response.json();
        setTextFeedbackMap(data.feedback || {});
        setCommentsMap(data.comments || {});
      } catch (error) {
        console.error('Error fetching initial feedback:', error);
      }
    };
    fetchInitialFeedback();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (commentBoxRef.current && !commentBoxRef.current.contains(event.target as Node)) {
        setIsCommenting(false);
        setMenuPosition(null);
      }
    };

    if (isCommenting) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isCommenting]);

  // Highlighting and applying feedback colors
  const highlightText = (node: Node, textToHighlight: string, backgroundColor: string, title?: string) => {
    if (node.nodeType === Node.TEXT_NODE && node.textContent?.includes(textToHighlight)) {
      const text = node.textContent;
      const index = text.indexOf(textToHighlight);
      const before = text.substring(0, index);
      const highlighted = text.substring(index, index + textToHighlight.length);
      const after = text.substring(index + textToHighlight.length);

      const span = document.createElement('span');
      span.className = 'highlighted';
      span.style.backgroundColor = backgroundColor;
      span.style.cursor = 'pointer';
      if (title) span.title = title;
      span.textContent = highlighted;

      node.parentNode?.insertBefore(document.createTextNode(before), node);
      node.parentNode?.insertBefore(span, node);
      node.parentNode?.insertBefore(document.createTextNode(after), node);
      node.parentNode?.removeChild(node);
      return true;
    }
    return false;
  };

  const applyHighlightingAndColors = () => {
    if (!documentViewerRef.current) return;

    // Clear existing highlights
    documentViewerRef.current.querySelectorAll('span.highlighted').forEach(span => {
      span.replaceWith(document.createTextNode(span.textContent!));
    });

    const allTexts = new Set([
      ...Object.keys(textFeedbackMap),
      ...Object.keys(commentsMap),
    ]);

    allTexts.forEach(text => {
      if (!text.trim()) return;

      const walker = document.createTreeWalker(documentViewerRef.current, NodeFilter.SHOW_TEXT);
      let node;
      let highlighted = false;

      while ((node = walker.nextNode()) && !highlighted) {
        if (!node.parentNode || node.parentNode.classList?.contains('highlighted')) continue;

        // Determine background color based on feedback type
        let backgroundColor = '#fff9cc'; // Default for comments only
        if (textFeedbackMap[text] === 'up') backgroundColor = '#dfffe0';
        if (textFeedbackMap[text] === 'down') backgroundColor = '#ffe5e5';

        // Add comment as title if it exists
        const title = commentsMap[text] || undefined;

        highlighted = highlightText(node, text, backgroundColor, title);
      }
    });
  };

  useEffect(() => {
    if (Object.keys(textFeedbackMap).length > 0 || Object.keys(commentsMap).length > 0) {
      applyHighlightingAndColors();
    }
  }, [textFeedbackMap, commentsMap]);

  // Update feedback in backend
  const updateFeedback = async (type: 'up' | 'down') => {
    if (selectionText) {
      try {
        const response = await fetch('http://127.0.0.1:8000/api/feedback/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: selectionText, type }),
        });
        if (response.ok) {
          setTextFeedbackMap(prev => ({ ...prev, [selectionText]: type }));
        } else {
          console.error(`Error posting feedback (${type}):`, response.status);
        }
      } catch (error) {
        console.error(`Error posting feedback (${type}):`, error);
      }
      setMenuPosition(null);
    }
  };

  const handleThumbsUp = () => updateFeedback('up');
  const handleThumbsDown = () => updateFeedback('down');

  // Handle justification logic
  const handleJustify = async (selection: string) => {
    setIsJustifying(true);
    try {
      const response = await fetch('http://127.0.0.1:8000/api/justify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selection }),
      });
      if (response.ok) {
        const data = await response.json();
        setJustification(data.justification);
        setOpenDialog(true);
      } else {
        console.error('Error fetching justification:', response.status);
      }
    } catch (error) {
      console.error('Error fetching justification:', error);
    } finally {
      setIsJustifying(false);
      setMenuPosition(null);
    }
  };

  // Handle comment logic
  const handleCommentChange = (event: React.ChangeEvent<HTMLInputElement>) => setComment(event.target.value);

  const handleCommentSubmit = async () => {
    if (!selectionText || !comment.trim()) return;
    
    try {
      const response = await fetch('http://127.0.0.1:8000/api/feedback/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: selectionText, 
          comment,
          type: textFeedbackMap[selectionText] || null,
        }),
      });
      if (response.ok) {
        setCommentsMap(prev => ({ ...prev, [selectionText]: comment }));
      } else {
        console.error('Error saving comment:', response.status);
      }
    } catch (error) {
      console.error('Error posting comment:', error);
    }

    setComment('');
    setIsCommenting(false);
    setMenuPosition(null);
  };

  const handleMouseUp = (event: React.MouseEvent<HTMLDivElement>) => {
    if (commentBoxRef.current?.contains(event.target as Node)) return;

    const selection = window.getSelection();
    const selectedText = selection?.toString().trim();

    if (selectedText && selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setSelectionText(selectedText);
      setMenuPosition({
        top: rect.top + window.scrollY - 40,
        left: rect.left + window.scrollX,
      });

      // Pre-fill comment if it exists
      setComment(commentsMap[selectedText] || '');
    } else {
      setSelectionText('');
      setMenuPosition(null);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: '#f8f9fa', px: 4, py: 2 }}>
      <Typography variant="h4" align="center" sx={{ mb: 4, fontWeight: 600 , color:'black'}}>
        AI Content Review App
      </Typography>

      <Box sx={{ flex: 1 }}>
        <Paper elevation={1} sx={{ p: 3, mb: 3 }}>
          <div ref={documentViewerRef}>
            <DocumentViewer documentUrl="/0_Summary.md" />
          </div>
        </Paper>
      </Box>

      {menuPosition && !isCommenting && (
        <Box sx={{ position: 'absolute', top: menuPosition.top, left: menuPosition.left, zIndex: 10, bgcolor: 'white', border: '1px solid #dadce0', borderRadius: 2, boxShadow: 2, p: 1, display: 'flex', justifyContent: 'space-between', gap: 1, width: 'fit-content' }}>
          <Tooltip title="Helpful">
            <IconButton onClick={handleThumbsUp}>
              <ThumbUp />
            </IconButton>
          </Tooltip>
          <Tooltip title="Not Helpful">
            <IconButton onClick={handleThumbsDown}>
              <ThumbDown />
            </IconButton>
          </Tooltip>
          <Tooltip title="Add a comment">
            <IconButton onClick={() => setIsCommenting(true)}>
              <Comment />
            </IconButton>
          </Tooltip>
          <Tooltip title="Justify">
            <IconButton onClick={() => handleJustify(selectionText)}>
              {isJustifying ? <CircularProgress size={24} /> : <GTranslate />}
            </IconButton>
          </Tooltip>
        </Box>
      )}

      {/* Comment Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)}>
        <DialogTitle>Justification</DialogTitle>
        <DialogContent>
          <Typography variant="body1">{justification}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default HomePage;
