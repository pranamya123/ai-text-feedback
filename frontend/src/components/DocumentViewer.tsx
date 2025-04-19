import React from 'react';

interface Props {
  documentUrl: string;
  highlightText?: string;
}

const DocumentViewer: React.FC<Props> = ({ documentUrl, highlightText }) => {
  const [content, setContent] = React.useState('');

  React.useEffect(() => {
    fetch(documentUrl)
      .then(res => res.text())
      .then(text => setContent(text))
      .catch(error => {
        console.error("Error fetching document:", error);
        setContent("Error loading document.");
      });
  }, [documentUrl]);

  const getHighlightedContent = () => {
    if (!highlightText) return content;

    const regex = new RegExp(`(${highlightText})`, 'gi');
    return content.split(regex).map((part, i) =>
      regex.test(part) ? (
        <span key={i} style={{ backgroundColor: 'yellow' }}>{part}</span>
      ) : (
        part
      )
    );
  };

  return (
    <div style={{
      whiteSpace: 'pre-wrap',
      lineHeight: '1.6',
      fontFamily: 'Arial, sans-serif',
      margin: '20px',
      padding: '10px',
    }}>
      {getHighlightedContent()}
    </div>
  );
};

export default DocumentViewer;