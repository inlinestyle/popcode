import React from 'react';
import {t} from 'i18next';

function EditorContainer(props) {
  let helpText;

  if (props.source === '') {
    helpText = (
      <div className="editors__help-text">
        {t(
          'editors.help-text',
          {language: props.language},
        )}
      </div>
    );
  }

  return (
    <div className="editors__editor-container" style={props.style}>
      <div
        className="environment__label label"
        onClick={props.onMinimize}
      >
        {t(`languages.${props.language}`)}
      </div>
      {helpText}
      {props.children}
    </div>
  );
}

EditorContainer.propTypes = {
  children: React.PropTypes.node.isRequired,
  language: React.PropTypes.string.isRequired,
  source: React.PropTypes.string.isRequired,
  style: React.PropTypes.object.isRequired,
  onMinimize: React.PropTypes.func.isRequired,
};

export default EditorContainer;
