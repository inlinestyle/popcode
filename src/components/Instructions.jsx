import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import InstructionsErrorBoundary from './InstructionsErrorBoundary';

export default function Instructions({instructions, isOpen}) {
  if (!instructions.markdown || !isOpen) {
    return null;
  }

  return (
    <div
      className={classnames(
        'layout__instructions',
        'instructions',
        'u__flex-container',
        'u__flex-container_column',
      )}
    >
      {instructions.markdown ?
        <InstructionsErrorBoundary instructions={instructions} /> :
        null}
    </div>
  );
}

Instructions.propTypes = {
  instructions: PropTypes.object.isRequired,
  isOpen: PropTypes.bool.isRequired,
};
