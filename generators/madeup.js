'use strict';

goog.provide('Blockly.Madeup');
goog.require('Blockly.Generator');
Blockly.Madeup = new Blockly.Generator('Madeup');

Blockly.Madeup.INDENT = '  ';            // 0 "" ...
Blockly.Madeup.ORDER_ATOMIC = 0;            // 0 "" ...
Blockly.Madeup.ORDER_ARRAY_OF = 2;
Blockly.Madeup.ORDER_ARRAY_BY = 3;
Blockly.Madeup.ORDER_EXPONENTIATION = 4;    // **
Blockly.Madeup.ORDER_MULTIPLICATIVE = 6;    // * / // %
Blockly.Madeup.ORDER_ADDITIVE = 7;          // + -
Blockly.Madeup.ORDER_RELATIONAL = 11;       // in, not in, is, is not,
Blockly.Madeup.ORDER_EQUALITY = 12;
Blockly.Madeup.ORDER_LOGICAL_NOT = 13;      // not
Blockly.Madeup.ORDER_LOGICAL_AND = 14;      // and
Blockly.Madeup.ORDER_LOGICAL_OR = 15;       // or
Blockly.Madeup.ORDER_CONDITIONAL = 16;      // if else
Blockly.Madeup.ORDER_FUNCTION_CALL_FIRST_PARAMETER = 30;     // ()
Blockly.Madeup.ORDER_FUNCTION_CALL_ONLY_PARAMETER = 30;     // ()
Blockly.Madeup.ORDER_FIRST_PARAMETER_SUBTRACTION = 31;          // + -
Blockly.Madeup.ORDER_UNARY_NEGATION = 31;        // + -
Blockly.Madeup.ORDER_FUNCTION_CALL_NOT_FIRST_PARAMETER = 32;     // ()
Blockly.Madeup.ORDER_NONE = 99;             // (...)
Blockly.Madeup.ORDER_FUNCTION_CALL = 33;     // ()
Blockly.Madeup.PROCEDURES_DEFRETURN_COMMENT = null;
Blockly.Madeup.PROCEDURES_DEFNORETURN_COMMENT = null;
Blockly.Madeup.addReservedWords('');

// Unary negation has lower precedence than first parameter. Meaning a unary
// negation in a first parameter slot will be parenthesized. Unary negation has
// higher precedence than non-first parameter, meaning in a non-first parameter
// slot it will not be parenthesized.
//
// I'd like to avoid parenthesizing parameters when the function only has one
// parameter. But I can't do this if the operation is unary negation.
//
// lower numbers - higher precedence

/**
 * Initialise the database of variable names.
 * @param {!Blockly.Workspace} workspace Workspace to generate code from.
 */
Blockly.Madeup.init = function(workspace) {
  // Create a dictionary of definitions to be printed before the code.
  // Blockly.Madeup.definitions_ = Object.create(null);
  // Create a dictionary mapping desired function names in definitions_
  // to actual function names (to avoid collisions with user functions).
  // Blockly.Madeup.functionNames_ = Object.create(null);

  if (!Blockly.Madeup.variableDB_) {
    Blockly.Madeup.variableDB_ = new Blockly.Names(Blockly.Madeup.RESERVED_WORDS_);
  } else {
    Blockly.Madeup.variableDB_.reset();
  }

  // var defvars = [];
  // var variables = Blockly.Variables.allVariables(workspace);
  // for (var x = 0; x < variables.length; x++) {
   // defvars[x] = Blockly.Madeup.variableDB_.getName(variables[x],
       // Blockly.Variables.NAME_TYPE) + ' = None';
  // }
  // Blockly.Madeup.definitions_['variables'] = defvars.join('\n');
};

/**
 * Prepend the generated code with the variable definitions.
 * @param {string} code Generated code.
 * @return {string} Completed code.
 */
Blockly.Madeup.finish = function(code) {
  // Convert the definitions dictionary into a list.
  // var imports = [];
  // var definitions = [];
  // for (var name in Blockly.Madeup.definitions_) {
    // var def = Blockly.Madeup.definitions_[name];
    // if (def.match(/^(from\s+\S+\s+)?import\s+\S+/)) {
      // imports.push(def);
    // } else {
      // definitions.push(def);
    // }
  // }
  // var allDefs = imports.join('\n') + '\n\n' + definitions.join('\n\n');
  // return allDefs.replace(/\n\n+/g, '\n\n').replace(/\n*$/, '\n\n\n') + code;
  return code;
};

/**
 * Naked values are top-level blocks with outputs that aren't plugged into
 * anything.
 * @param {string} line Line of generated code.
 * @return {string} Legal line of code.
 */
Blockly.Madeup.scrubNakedValue = function(line) {
  return line + '\n';
};

/**
 * Common tasks for generating Python from blocks.
 * Handles comments for the specified block and any connected value blocks.
 * Calls any statements following this block.
 * @param {!Blockly.Block} block The current block.
 * @param {string} code The Python code created for this block.
 * @return {string} Python code with comments and subsequent blocks added.
 * @private
 */
Blockly.Madeup.scrub_ = function(block, code) {
  var commentCode = '';
  // Only collect comments for blocks that aren't inline.
  if (!block.outputConnection || !block.outputConnection.targetConnection) {
    // Collect comment for this block.
    var comment = block.getCommentText();
    if (comment) {
      commentCode += Blockly.Madeup.prefixLines(comment, '-- ') + '\n';
    }
    // Collect comments for all value arguments.
    // Don't collect comments for nested statements.
    for (var x = 0; x < block.inputList.length; x++) {
      if (block.inputList[x].type == Blockly.INPUT_VALUE) {
        var childBlock = block.inputList[x].connection.targetBlock();
        if (childBlock) {
          var comment = Blockly.Madeup.allNestedComments(childBlock);
          if (comment) {
            commentCode += Blockly.Madeup.prefixLines(comment, '-- ');
          }
        }
      }
    }
  }
  var nextBlock = block.nextConnection && block.nextConnection.targetBlock();
  var nextCode = Blockly.Madeup.blockToCode(nextBlock);
  return commentCode + code + nextCode;
};

/*
 * Statements return their source code. Expressions yield their code plus their lowest precedence.
 */

function generateInMode(block, code, precedence) {
  if (block.outputConnection) {
    return [code, precedence];
  } else {
    return code + '\n';
  }
}

// --------------------------------------------------------------------------- 
// GENERATORS FOR BUILTINS

Blockly.Madeup['variables_get'] = function(block) {
  var code = Blockly.Madeup.variableDB_.getName(block.getFieldValue('VAR'), Blockly.Variables.NAME_TYPE);
  return generateInMode(block, code, Blockly.Madeup.ORDER_ATOMIC);
};

Blockly.Madeup['variables_set'] = function(block) {
  var argument0 = Blockly.Madeup.valueToCode(block, 'VALUE', Blockly.Madeup.ORDER_NONE) || '0';
  var varName = Blockly.Madeup.variableDB_.getName(block.getFieldValue('VAR'), Blockly.Variables.NAME_TYPE);
  var code = varName + ' = ' + argument0;
  return generateInMode(block, code, Blockly.Madeup.ORDER_ATOMIC);
};

Blockly.Madeup['procedures_defnoreturn'] = function(block) {
  var funcName = Blockly.Madeup.variableDB_.getName(block.getFieldValue('NAME'), Blockly.Procedures.NAME_TYPE);
  var branch = Blockly.Madeup.statementToCode(block, 'STACK');

  var args = [];
  for (var x = 0; x < block.arguments_.length; x++) {
    args[x] = Blockly.Madeup.variableDB_.getName(block.arguments_[x], Blockly.Variables.NAME_TYPE);
  }

  var code = 'to ' + funcName + ' ' + args.join(', ') + '\n' + branch + 'end';
  return generateInMode(block, code, Blockly.Madeup.ORDER_ATOMIC);
};

Blockly.Madeup['procedures_callnoreturn'] = function(block) {
  var funcName = Blockly.Madeup.variableDB_.getName(block.getFieldValue('NAME'), Blockly.Procedures.NAME_TYPE);
  var args = [];
  var precedence;
  for (var i = 0; i < block.arguments_.length; i++) {
    if (block.arguments_.length == 1) {
      precedence = Blockly.Madeup.ORDER_FUNCTION_CALL_ONLY_PARAMETER;
    } else if (i == 0) {
      precedence = Blockly.Madeup.ORDER_FUNCTION_CALL_FIRST_PARAMETER;
    } else {
      precedence = Blockly.Madeup.ORDER_FUNCTION_CALL_NOT_FIRST_PARAMETER;
    }
    args[i] = Blockly.Madeup.valueToCode(block, 'ARG' + i, precedence) || '';
  }
  var code = funcName;
  if (args.length) {
    code += ' ' + args.join(', ');
  }
  return generateInMode(block, code, Blockly.Madeup.ORDER_FUNCTION_CALL);
};

Blockly.Madeup['madeup_array_literal'] = function(block) {
  var elements = [];
  for (var i = 0; i < block.itemCount_; i++) {
    elements[i] = Blockly.Madeup.valueToCode(block, 'ELEMENT' + i, Blockly.Madeup.ORDER_ATOMIC) || '';
  }
  var code = '{' + elements.join(', ') + '}';
  return generateInMode(block, code, Blockly.Madeup.ORDER_ATOMIC);
};

for (var block_type in block_definitions) {
  if (block_definitions.hasOwnProperty(block_type)) {
    Blockly.Madeup[block_type] = block_definitions[block_type].generator;
  }
}
