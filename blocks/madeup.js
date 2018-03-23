goog.require('Blockly.Blocks');
goog.provide('Blockly.Blocks.madeup');

Blockly.Blocks.madeup.EXPRESSION_HUE = 315;
Blockly.Blocks.madeup.STATEMENT_HUE = 180;

function getBlocklyProcedureFormals(workspace, name) {
  // allProcedures gives back [procedures with return, procedures without
  // return]. We only have the latter.

  var procs = Blockly.Procedures.allProcedures(workspace)[0];
  // TODO

  // Find the procedure in the list with the given name.
  for (var i = 0; i < procs.length; ++i) {
    if (procs[i][0] == name) {
      return procs[i][1];
    }
  }

  throw 'No procedure named ' + name;
}

function setStatementExpression(block, isExpression) {
  var isExpressionAlready = !!block.outputConnection;
  if (isExpression != isExpressionAlready) {
    block.unplug(true, true);
    if (isExpression) {
      block.setPreviousStatement(false);
      block.setNextStatement(false);
      block.setOutput(true);
      block.setColour(Blockly.Blocks.madeup.EXPRESSION_HUE);
    } else {
      block.setOutput(false);
      block.setPreviousStatement(true);
      block.setNextStatement(true);
      block.setColour(Blockly.Blocks.madeup.STATEMENT_HUE);
    }
  }
}

function contextMenuPlusPlus(options) {
  var isExpression = !!this.outputConnection;
  var block = this;

  // Toggle between expression and statement.
  var option = {
    enabled: true,
    text: isExpression ? 'Convert to Statement' : 'Convert to Expression',
    callback: function() {
      setStatementExpression(block, !isExpression);
    }
  };
  options.push(option);

  // Extract single selected block from stack.
  option = {
    enabled: true,
    text: 'Disconnect',
    callback: function() {
      block.unplug(true);
    }
  };
  options.push(option);

  if (block.madeup.hasOwnProperty('formals') && block.madeup.formals) {
    for (var i = 0; i < block.madeup.formals.length; ++i) {
      if (block.madeup.formals[i].hasOwnProperty('default')) {
        option = (function(arg) {
          return {
            enabled: true,
            text: 'Toggle parameter ' + arg.name,
            callback: function() {
              var oldMutation = block.mutationToDom();
              var lostXml = block.enableParameter(arg.name, !block.isParameterEnabled(arg.name));
              var newMutation = block.mutationToDom();

              // Add lost block to mutation.
              if (lostXml) {
                var submutation = oldMutation.firstElementChild;
                while (submutation) {
                  if (submutation.nodeName.toLowerCase() == 'defaults') {
                    var defaultParameter = submutation.firstElementChild;
                    while (defaultParameter) {
                      if (defaultParameter.getAttribute('id') == arg.name) {
                        defaultParameter.appendChild(lostXml);
                      }
                      defaultParameter = defaultParameter.nextElementSibling;
                    }
                  }
                  submutation = submutation.nextElementSibling;
                }
              }

              var event = new Blockly.Events.BlockChange(block, 'mutation', null, Blockly.Xml.domToText(oldMutation), Blockly.Xml.domToText(newMutation));
              Blockly.Events.fire(event);
            }
          };
        })(block.madeup.formals[i], block.madeup.message);
        options.push(option);
      }
    }
  }
}

function mutationModeToDom(block, container) {
  var isExpression = !!block.outputConnection;
  container.setAttribute('isexpression', isExpression);

  if (block.hasOwnProperty('madeup') && block.madeup.hasOwnProperty('formals') && block.madeup.formals) {
    var ids = [];
    for (var i = 0; i < block.madeup.formals.length; ++i) {
      var arg = block.madeup.formals[i];
      if (arg.hasOwnProperty('default')) {
        ids.push(arg.name);
      }
    }

    if (ids.length > 0) {
      var defaults = document.createElement('defaults');
      container.appendChild(defaults);
      for (var i = 0; i < ids.length; ++i) {
        var state = document.createElement('default')
        state.setAttribute('id', ids[i]);
        state.setAttribute('enabled', block.isParameterEnabled(ids[i]));
        defaults.appendChild(state);
      }
    }
  }
}

function mutationToDom() {
  var container = document.createElement('mutation');
  mutationModeToDom(this, container);
  return container;
}

function isParameterOptional(arg) {
  return arg.hasOwnProperty('default');
}

function hasOptionalParameters(args) {
  for (var i = 0; i < args.length; ++i) {
    if (isParameterOptional(args[i])) {
      return true;
    }
  }
  return false;
}

Blockly.Block.prototype.isCallWithNames = function() {
  if (this.madeup.hasOwnProperty('formals') && this.madeup.formals && this.madeup.formals.length > 1) {
    var isPredecessorOn = this.isParameterEnabled(this.madeup.formals[0].name);
    for (var i = 1; i < this.madeup.formals.length; ++i) {
      var isOn = this.isParameterEnabled(this.madeup.formals[i].name);
      if (isOn && !isPredecessorOn) {
        return true;
      }
      isPredecessorOn = isOn;
    }
  }
  return false;
}

Blockly.Block.prototype.isParameterEnabled = function(id) {
  return this.getInput(id) !== null && this.getInput(id).type !== Blockly.DUMMY_INPUT;
}

Blockly.Block.prototype.enableParameter = function(formal, isEnabled) {
  var isAlreadyEnabled = this.isParameterEnabled(formal);
  if (isEnabled === isAlreadyEnabled) {
    return null;
  }

  var input = this.getInput(formal);
  var lostXml = null;
  
  if (input) {
    if (!isEnabled && input.connection.targetBlock()) {
      Blockly.Events.disable();
      var lostBlock = input.connection.targetBlock();
      var lostXml = Blockly.Xml.blockToDom(lostBlock);
      lostBlock.dispose();
      Blockly.Events.enable();
    }
    this.removeInput(formal);
  }

  var regex = new RegExp('^(?:.*%\\d+\\s+)*(.*)' + formal + '\\s+%(\\d+)');
  var match = regex.exec(this.madeup.message);
  var prefix = match[1];
  var iPosition = parseInt(match[2]);
  
  if (isEnabled) {
    this.appendValueInput(formal)
        .appendField(prefix + formal)
        .setAlign(Blockly.ALIGN_RIGHT);
  } else {
    if (iPosition == 1) {
      this.appendDummyInput(formal).appendField(prefix.trim());
    }
  }

  return lostXml;
}

function domModeToMutation(element) {
  var isExpression = element.getAttribute('isexpression') == 'true';
  setStatementExpression(this, isExpression); 

  var submutation = element.firstElementChild;
  var foundDefaults = false;
  while (submutation != null) {
    // nodeName is uppercase for some reason. XML nodes are supposed to
    // maintain their case, but HTML are canonically capitalized.
    if (submutation.nodeName.toLowerCase() == 'defaults') {
      var foundDefaults = true;
      var defaultFormal = submutation.firstElementChild;
      while (defaultFormal) {
        var isEnabled = defaultFormal.getAttribute('enabled') === 'true';
        var id = defaultFormal.getAttribute('id');
        this.enableParameter(id, isEnabled);

        // Inspect child for block.
        if (defaultFormal.firstElementChild) {
          var actual = Blockly.Xml.domToBlock(defaultFormal.firstElementChild, this.workspace);
          this.getInput(id).connection.connect(actual.outputConnection);
        }

        defaultFormal = defaultFormal.nextElementSibling;
      }
    }
    submutation = submutation.nextElementSibling;
  }
}

function generateCall(block) {
  var match = block.madeup.message.match(/^\w+/);
  var code = match[0];
  if (block.isCallWithNames()) {
    for (var i = 0; i < block.madeup.formals.length; ++i) {
      var arg = block.madeup.formals[i];
      if (this.isParameterEnabled(arg.name)) {
        var value = Blockly.Madeup.valueToCode(block, arg.name, Blockly.Madeup.ORDER_FUNCTION_CALL);
        code += ' ' + arg.name + ':' + value + '';
      }
    }
  } else if (block.madeup.hasOwnProperty('formals') && block.madeup.formals) {
    var actuals = [];
    for (var i = 0; i < block.madeup.formals.length; ++i) {
      var arg = block.madeup.formals[i];
      if (this.isParameterEnabled(arg.name)) {
        var precedence;
        if (i == 0 && block.madeup.formals.length == 1) {
          precedence = Blockly.Madeup.ORDER_FUNCTION_CALL_ONLY_PARAMETER;
        } else if (i == 0) {
          precedence = Blockly.Madeup.ORDER_FUNCTION_CALL_FIRST_PARAMETER;
        } else {
          precedence = Blockly.Madeup.ORDER_FUNCTION_CALL_NOT_FIRST_PARAMETER;
        }
        var value = Blockly.Madeup.valueToCode(block, arg.name, precedence);
        actuals.push(value);
      }
    }

    if (actuals.length > 0) {
      code += ' ' + actuals.join(', ');
    }
  }

  return generateInMode(block, code, Blockly.Madeup.ORDER_FUNCTION_CALL);
}

var blockDefinitions = {
  'madeup_tube': {
    config:
      {
        "message0": "tube maxBend %1 twist %2",
        "args0": [
          { "type": "input_value", "align": "RIGHT", "name": "maxBend", "check": ["Real", "Integer"], "default": "(INTEGER 360)" },
          { "type": "input_value", "align": "RIGHT", "name": "twist", "check": ["Real", "Integer"], "default": "(INTEGER 45)" },
        ],
        "inputsInline": false,
        "previousStatement": null,
        "nextStatement": null,
        "colour": Blockly.Blocks.madeup.STATEMENT_HUE,
        "tooltip": "",
        "helpUrl": "http://www.example.com/",
        "sid": "tube"
      },
    generator: generateCall
  },
  'madeup_spheres': {
    config:
      {
        "message0": "spheres",
        "previousStatement": null,
        "nextStatement": null,
        "colour": Blockly.Blocks.madeup.STATEMENT_HUE,
        "tooltip": "",
        "helpUrl": "http://www.example.com/",
        "sid": "spheres"
      },
    generator: generateCall
  },
  'madeup_forget': {
    config:
      {
        "message0": "forget",
        "previousStatement": null,
        "nextStatement": null,
        "colour": Blockly.Blocks.madeup.STATEMENT_HUE,
        "tooltip": "",
        "helpUrl": "http://www.example.com/",
        "sid": "forget"
      },
    generator: generateCall
  },
  'madeup_polygon': {
    config:
      {
        "message0": "polygon flip %1",
        "args0": [
          { "type": "input_value", "align": "RIGHT", "name": "flip", "check": ["Boolean"], "default": "(BOOLEAN false)" },
        ],
        "previousStatement": null,
        "nextStatement": null,
        "colour": Blockly.Blocks.madeup.STATEMENT_HUE,
        "tooltip": "",
        "helpUrl": "http://www.example.com/",
        "sid": "polygon"
      },
    generator: generateCall
  },
  'madeup_boxes': {
    config:
      {
        "message0": "boxes",
        "previousStatement": null,
        "nextStatement": null,
        "colour": Blockly.Blocks.madeup.STATEMENT_HUE,
        "tooltip": "",
        "helpUrl": "http://www.example.com/",
        "sid": "boxes"
      },
    generator: generateCall
  },
  'madeup_extrude': {
    config:
      {
        "message0": "extrude x %1 y %2 z %3 length %4",
        "args0": [
          { "type": "input_value", "align": "RIGHT", "name": "x", "check": ["Real", "Integer"] },
          { "type": "input_value", "align": "RIGHT", "name": "y", "check": ["Real", "Integer"] },
          { "type": "input_value", "align": "RIGHT", "name": "z", "check": ["Real", "Integer"] },
          { "type": "input_value", "align": "RIGHT", "name": "length", "check": ["Real", "Integer"] },
        ],
        "inputsInline": false,
        "previousStatement": null,
        "nextStatement": null,
        "colour": Blockly.Blocks.madeup.STATEMENT_HUE,
        "tooltip": "",
        "helpUrl": "http://www.example.com/",
        "sid": "extrude"
      },
    generator: generateCall
  },
  'madeup_revolve': {
    config:
      {
        "message0": "revolve x %1 y %2 z %3 degrees %4",
        "args0": [
          { "type": "input_value", "align": "RIGHT", "name": "x", "check": ["Real", "Integer"] },
          { "type": "input_value", "align": "RIGHT", "name": "y", "check": ["Real", "Integer"] },
          { "type": "input_value", "align": "RIGHT", "name": "z", "check": ["Real", "Integer"] },
          { "type": "input_value", "align": "RIGHT", "name": "degrees", "check": ["Real", "Integer"] },
        ],
        "inputsInline": false,
        "previousStatement": null,
        "nextStatement": null,
        "colour": Blockly.Blocks.madeup.STATEMENT_HUE,
        "tooltip": "",
        "helpUrl": "http://www.example.com/",
        "sid": "revolve"
      },
    generator: generateCall
  },
  'madeup_unary_operator': {
    config:
      {
        "message0": "-%1",
        "args0": [
          { "type": "input_value", "name": "a", "check": ["Integer", "Real"] },
        ],
        "inputsInline": true,
        "output": ["Integer", "Real"],
        "colour": Blockly.Blocks.madeup.EXPRESSION_HUE,
        "tooltip": "",
        "helpUrl": "http://www.example.com/"
      },
    generator:
      function (block) {
        var value_a = Blockly.Madeup.valueToCode(block, 'a', Blockly.Madeup.ORDER_UNARY_NEGATION);
        var code = '-' + value_a;
        return generateInMode(block, code, Blockly.Madeup.ORDER_UNARY_NEGATION);
      }
  },
  'madeup_minmax': {
    config:
      {
        "message0": "%1 %2 %3",
        "args0": [
          {
            "type": "field_dropdown",
            "name": "function",
            "options": [
              [ "min", "MIN" ],
              [ "max", "MAX" ],
            ]
          },
          { "type": "input_value", "name": "a", "check": ["Integer", "Real"] },
          { "type": "input_value", "name": "b", "check": ["Integer", "Real"] }
        ],
        "inputsInline": false,
        "output": ["Integer", "Real"],
        "colour": Blockly.Blocks.madeup.EXPRESSION_HUE,
        "tooltip": "",
        "helpUrl": "http://www.example.com/",
        "sid": ["min", "max"]
      },
    generator:
      function (block) {
        var value_a = Blockly.Madeup.valueToCode(block, 'a', Blockly.Madeup.ORDER_FUNCTION_CALL_FIRST_PARAMETER);
        var dropdown_f = block.getFieldValue('function');
        var value_b = Blockly.Madeup.valueToCode(block, 'b', Blockly.Madeup.ORDER_FUNCTION_CALL_NOT_FIRST_PARAMETER);
        var code = dropdown_f.toLowerCase() + ' ' + value_a + ', ' + value_b;
        return generateInMode(block, code, Blockly.Madeup.ORDER_FUNCTION_CALL);
      }
  },
  'madeup_random': {
    config:
      {
        "message0": "random min %1 max %2",
        "args0": [
          { "type": "input_value", "align": "RIGHT", "name": "min", "check": ["Integer"] },
          { "type": "input_value", "align": "RIGHT", "name": "max", "check": ["Integer"] }
        ],
        "inputsInline": false,
        "output": ["Integer"],
        "colour": Blockly.Blocks.madeup.EXPRESSION_HUE,
        "tooltip": "",
        "helpUrl": "http://www.example.com/",
        "sid": "random"
      },
    generator: generateCall
  },
  'madeup_random01': {
    config:
      {
        "message0": "random01",
        "output": ["Real"],
        "colour": Blockly.Blocks.madeup.EXPRESSION_HUE,
        "tooltip": "",
        "helpUrl": "http://www.example.com/",
        "sid": "random01"
      },
    generator: generateCall
  },
  'madeup_atan2': {
    config:
      {
        "message0": "atan2 opposite %1 adjacent %2",
        "args0": [
          { "type": "input_value", "align": "RIGHT", "name": "opposite", "check": ["Integer", "Real"] },
          { "type": "input_value", "align": "RIGHT", "name": "adjacent", "check": ["Integer", "Real"] }
        ],
        "inputsInline": false,
        "output": ["Real", "Integer"],
        "colour": Blockly.Blocks.madeup.EXPRESSION_HUE,
        "tooltip": "",
        "helpUrl": "http://www.example.com/",
        "sid": "atan2"
      },
    generator: generateCall
  },
  'madeup_log': {
    config:
      {
        "message0": "log base %1 x %2",
        "args0": [
          { "type": "input_value", "align": "RIGHT", "name": "base", "check": ["Integer", "Real"] },
          { "type": "input_value", "align": "RIGHT", "name": "x", "check": ["Integer", "Real"] }
        ],
        "inputsInline": false,
        "output": ["Real"],
        "colour": Blockly.Blocks.madeup.EXPRESSION_HUE,
        "tooltip": "",
        "helpUrl": "http://www.example.com/",
        "sid": "log"
      },
    generator: generateCall
  },
  'madeup_if_expr': {
    config:
      {
        "message0": "if %1 then %2 else %3",
        "args0": [
          { "type": "input_value", "name": "condition", "check": ["Boolean"] },
          { "type": "input_value", "name": "then" },
          { "type": "input_value", "name": "else" }
        ],
        "inputsInline": true,
        "output": null,
        "colour": Blockly.Blocks.madeup.EXPRESSION_HUE,
        "tooltip": "",
        "helpUrl": "http://www.example.com/"
      },
    generator:
      function (block) {
        var value_condition = Blockly.Madeup.valueToCode(block, 'condition', Blockly.Madeup.ORDER_NONE);
        var value_then = Blockly.Madeup.valueToCode(block, 'then', Blockly.Madeup.ORDER_CONDITIONAL);
        var value_else = Blockly.Madeup.valueToCode(block, 'else', Blockly.Madeup.ORDER_CONDITIONAL);
        var code = 'if ' + value_condition + ' then ' + value_then + ' else ' + value_else;
        return generateInMode(block, code, Blockly.Madeup.ORDER_CONDITIONAL);
      }
  },
  'madeup_if_statement': {
    config:
      {
        "message0": "if %1 then %2",
        "args0": [
          { "type": "input_value", "name": "condition", "check": "Boolean" },
          { "type": "input_statement", "name": "then" }
        ],
        "inputsInline": true,
        "previousStatement": null,
        "nextStatement": null,
        "colour": Blockly.Blocks.madeup.STATEMENT_HUE,
        "tooltip": "",
        "helpUrl": "http://www.example.com/"
      },
    generator:
      function (block) {
        var value_condition = Blockly.Madeup.valueToCode(block, 'condition', Blockly.Madeup.ORDER_CONDITIONAL);
        var statements_then = Blockly.Madeup.statementToCode(block, 'then');
        var code = 'if ' + value_condition + '\n' + statements_then + 'end';
        return generateInMode(block, code, Blockly.Madeup.ORDER_ATOMIC);
      }
  },
  'madeup_if_else_statement': {
    config:
      {
        "message0": "if %1 then %2 else %3",
        "args0": [
          { "type": "input_value", "name": "condition", "check": "Boolean" },
          { "type": "input_statement", "name": "then" },
          { "type": "input_statement", "name": "else" },
        ],
        "inputsInline": true,
        "previousStatement": null,
        "nextStatement": null,
        "colour": Blockly.Blocks.madeup.STATEMENT_HUE,
        "tooltip": "",
        "helpUrl": "http://www.example.com/"
      },
    generator:
      function (block) {
        var value_condition = Blockly.Madeup.valueToCode(block, 'condition', Blockly.Madeup.ORDER_CONDITIONAL);
        var statements_then = Blockly.Madeup.statementToCode(block, 'then');
        var statements_else = Blockly.Madeup.statementToCode(block, 'else');
        var code = 'if ' + value_condition + '\n' + statements_then + 'else\n' + statements_else + 'end';
        return generateInMode(block, code, Blockly.Madeup.ORDER_ATOMIC);
      }
  },
  'madeup_rotate': {
    config:
      {
        "message0": "rotate x %1 y %2 z %3 degrees %4",
        "args0": [
          { "type": "input_value", "align": "RIGHT", "name": "x", "check": ["Real", "Integer"] },
          { "type": "input_value", "align": "RIGHT", "name": "y", "check": ["Real", "Integer"] },
          { "type": "input_value", "align": "RIGHT", "name": "z", "check": ["Real", "Integer"] },
          { "type": "input_value", "align": "RIGHT", "name": "degrees", "check": ["Real", "Integer"] },
        ],
        "inputsInline": false,
        "previousStatement": null,
        "nextStatement": null,
        "colour": Blockly.Blocks.madeup.STATEMENT_HUE,
        "tooltip": "",
        "helpUrl": "http://www.example.com/",
        "sid": "rotate"
      },
    generator: generateCall
  },
  'madeup_scale': {
    config:
      {
        "message0": "scale x %1 y %2 z %3",
        "args0": [
          { "type": "input_value", "align": "RIGHT", "name": "x", "check": ["Real", "Integer"] },
          { "type": "input_value", "align": "RIGHT", "name": "y", "check": ["Real", "Integer"] },
          { "type": "input_value", "align": "RIGHT", "name": "z", "check": ["Real", "Integer"] }
        ],
        "inputsInline": false,
        "previousStatement": null,
        "nextStatement": null,
        "colour": Blockly.Blocks.madeup.STATEMENT_HUE,
        "tooltip": "",
        "helpUrl": "http://www.example.com/",
        "sid": "scale"
      },
    generator: generateCall
  },
  'madeup_translate': {
    config:
      {
        "message0": "translate x %1 y %2 z %3",
        "args0": [
          { "type": "input_value", "align": "RIGHT", "name": "x", "check": ["Real", "Integer"] },
          { "type": "input_value", "align": "RIGHT", "name": "y", "check": ["Real", "Integer"] },
          { "type": "input_value", "align": "RIGHT", "name": "z", "check": ["Real", "Integer"] }
        ],
        "inputsInline": false,
        "previousStatement": null,
        "nextStatement": null,
        "colour": Blockly.Blocks.madeup.STATEMENT_HUE,
        "tooltip": "",
        "helpUrl": "http://www.example.com/",
        "sid": "translate"
      },
    generator: generateCall
  },
  'madeup_string': {
    config:
      {
        "message0": "%1",
        "args0": [
          { "type": "field_input", "name": "string", "text": "text" }
        ],
        "inputsInline": false,
        "output": "String",
        "colour": Blockly.Blocks.madeup.EXPRESSION_HUE,
        "tooltip": "",
        "helpUrl": "http://www.example.com/"
      },
    generator:
      function (block) {
        var text_string = block.getFieldValue('string');
        var code = '"' + text_string + '"';
        return generateInMode(block, code, Blockly.Madeup.ORDER_ATOMIC);
      }
  },
  'madeup_sign': {
    config:
      {
        "message0": "sign %1",
        "args0": [
          { "type": "input_value", "name": "x", "check": ["Integer", "Real"] }
        ],
        "inputsInline": true,
        "output": ["Integer", "Real"],
        "colour": Blockly.Blocks.madeup.EXPRESSION_HUE,
        "tooltip": "",
        "helpUrl": "http://www.example.com/",
        "sid": "sign"
      },
    generator: generateCall
  },
  'madeup_abs': {
    config:
      {
        "message0": "abs %1",
        "args0": [
          { "type": "input_value", "name": "x", "check": ["Integer", "Real"] }
        ],
        "inputsInline": true,
        "output": ["Integer", "Real"],
        "colour": Blockly.Blocks.madeup.EXPRESSION_HUE,
        "tooltip": "",
        "helpUrl": "http://www.example.com/"
      },
    generator:
      function (block) {
        var value_x = Blockly.Madeup.valueToCode(block, 'x', Blockly.Madeup.ORDER_NONE);
        var code = '|' + value_x + '|';
        return generateInMode(block, code, Blockly.Madeup.ORDER_ATOMIC);
      }
  },
  'madeup_binary_arithmetic_operator': {
    config:
      {
        "message0": "%1 %2 %3",
        "args0": [
          { "type": "input_value", "name": "a", "check": ["Integer", "Real", "Array", "Mesh", "String"] },
          {
            "type": "field_dropdown",
            "name": "operator",
            "options": [
              [ "+", "+" ],
              [ "-", "-" ],
              [ "*", "*" ],
              [ "/", "/" ],
              [ "//", "//" ],
              [ "%", "%" ]
            ]
          },
          { "type": "input_value", "name": "b", "check": ["Integer", "Real", "Array", "Mesh", "String"] }
        ],
        "inputsInline": true,
        "output": ["Integer", "Real", "Path", "Mesh", "Array"],
        "colour": Blockly.Blocks.madeup.EXPRESSION_HUE,
        "tooltip": "",
        "helpUrl": "http://www.example.com/"
      },
    generator:
      function (block) {
        var dropdown_operator = block.getFieldValue('operator');

        var precedence;

        // If this is a subtraction from an identifier that appears as the
        // first parameter to a function call [func a - 7, b, c], we need some
        // parentheses [func (a - 7), b, c].
        var block_a = block.getInputTargetBlock('a');
        if (block.getParent().getChildren()[0] == block &&
            dropdown_operator == '-' &&
            block_a.type == 'variables_get' || block_a.type == 'procedures_callnoreturn') {
          precedence = Blockly.Madeup.ORDER_FIRST_PARAMETER_SUBTRACTION;
        } else if (dropdown_operator == '+' || dropdown_operator == '-') {
          precedence = Blockly.Madeup.ORDER_ADDITIVE;
        } else if (dropdown_operator == '*' || dropdown_operator == '/' || dropdown_operator == '//' || dropdown_operator == '%') {
          precedence = Blockly.Madeup.ORDER_MULTIPLICATIVE;
        } else {
          precedence = Blockly.Madeup.ORDER_EXPONENTIATION;
        } 

        var value_a = Blockly.Madeup.valueToCode(block, 'a', precedence);
        var value_b = Blockly.Madeup.valueToCode(block, 'b', precedence);
        var code = value_a + ' ' + dropdown_operator + ' ' + value_b;
        return generateInMode(block, code, precedence);
      }
  },
  'madeup_relational_operator': {
    config:
      {
        "message0": "%1 %2 %3",
        "args0": [
          { "type": "input_value", "name": "a", "check": ["Integer", "Real", "Array", "String"] },
          {
            "type": "field_dropdown",
            "name": "operator",
            "options": [
              [ ">", ">" ],
              [ ">=", ">=" ],
              [ "<", "<" ],
              [ "<=", "<=" ],
              [ "==", "==" ],
              [ "!=", "!=" ]
            ]
          },
          { "type": "input_value", "name": "b", "check": ["Integer", "Real", "Array", "String"] }
        ],
        "inputsInline": true,
        "output": "Boolean",
        "colour": Blockly.Blocks.madeup.EXPRESSION_HUE,
        "tooltip": "",
        "helpUrl": "http://www.example.com/"
      },
    generator:
      function (block) {
        var dropdown_operator = block.getFieldValue('operator');
        var precedence;
        if (dropdown_operator == '==' || dropdown_operator == '!=') {
          precedence = Blockly.Madeup.ORDER_EQUALITY;
        } else {
          precedence = Blockly.Madeup.ORDER_RELATIONAL;
        }
        var value_a = Blockly.Madeup.valueToCode(block, 'a', precedence);
        var value_b = Blockly.Madeup.valueToCode(block, 'b', precedence);
        var code = value_a + ' ' + dropdown_operator + ' ' + value_b;
        return generateInMode(block, code, precedence);
      }
  },
  'madeup_print': {
    config:
      {
        "message0": "print %1",
        "colour": Blockly.Blocks.madeup.STATEMENT_HUE,
        "args0": [ { "type": "input_value", "name": "message" } ],
        "inputsInline": false,
        "previousStatement": null,
        "nextStatement": null,
        "tooltip": "",
        "helpUrl": "http://www.example.com/",
        "sid": "print"
      },
    generator: generateCall
  },
  'madeup_debug': {
    config:
      {
        "message0": "debug %1",
        "colour": Blockly.Blocks.madeup.STATEMENT_HUE,
        "args0": [ { "type": "input_value", "name": "message" } ],
        "inputsInline": false,
        "previousStatement": null,
        "nextStatement": null,
        "tooltip": "",
        "helpUrl": "http://www.example.com/",
        "sid": "debug"
      },
    generator: generateCall
  },
  'madeup_integer': {
    config:
      {
        "message0": "%1",
        "args0": [
          { "type": "field_input", "name": "integer", "text": "0" }
        ],
        "inputsInline": false,
        "output": "Integer",
        "colour": Blockly.Blocks.madeup.EXPRESSION_HUE,
        "tooltip": "",
        "helpUrl": "http://www.example.com/"
      },
    generator:
      function (block) {
        var code = block.getFieldValue('integer');
        return generateInMode(block, code, Blockly.Madeup.ORDER_ATOMIC);
      }
  },
  'madeup_real': {
    config:
      {
        "message0": "%1",
        "args0": [
          { "type": "field_input", "name": "real", "text": "0.0" }
        ],
        "inputsInline": false,
        "output": "Real",
        "colour": Blockly.Blocks.madeup.EXPRESSION_HUE,
        "tooltip": "",
        "helpUrl": "http://www.example.com/"
      },
    generator:
      function (block) {
        var code = block.getFieldValue('real');
        return generateInMode(block, code, Blockly.Madeup.ORDER_ATOMIC);
      }
  },
  'madeup_nothing': {
    config:
      {
        "message0": "nothing",
        "output": "Nothing",
        "colour": Blockly.Blocks.madeup.EXPRESSION_HUE,
        "tooltip": "",
        "helpUrl": "http://www.example.com/"
      },
    generator:
      function (block) {
        var code = 'nothing';
        return generateInMode(block, code, Blockly.Madeup.ORDER_ATOMIC);
      }
  },
  'madeup_boolean': {
    config:
      {
        "message0": "%1",
        "args0": [
          {
            "type": "field_dropdown",
            "name": "boolean",
            "options": [
              [ "true", "TRUE" ],
              [ "false", "FALSE" ]
            ]
          },
        ],
        "inputsInline": true,
        "output": "Boolean",
        "colour": Blockly.Blocks.madeup.EXPRESSION_HUE,
        "tooltip": "",
        "helpUrl": "http://www.example.com/"
      },
    generator:
      function (block) {
        var dropdown_boolean = block.getFieldValue('boolean');
        var code = dropdown_boolean.toLowerCase();
        return generateInMode(block, code, Blockly.Madeup.ORDER_ATOMIC);
      }
  },
  'madeup_center': {
    config:
      {
        "message0": "center %1",
        "args0": [
          { "type": "input_value", "align": "RIGHT", "name": "object", "check": ["Mesh", "Path"] },
        ],
        "previousStatement": null,
        "nextStatement": null,
        "colour": Blockly.Blocks.madeup.STATEMENT_HUE,
        "tooltip": "",
        "helpUrl": "http://www.example.com/",
        "sid": "center"
      },
    generator: generateCall
  },
  'madeup_mirror': {
    config:
      {
        "message0": "mirror axis %1 path %2 point %3",
        "args0": [
          { "type": "input_value", "align": "RIGHT", "name": "axis", "check": ["Array"] },
          { "type": "input_value", "align": "RIGHT", "name": "path", "check": ["Path"], "default": "(PATH)" },
          { "type": "input_value", "align": "RIGHT", "name": "point", "check": ["Array"], "default": "(ARRAYLITERAL (INTEGER 0) (INTEGER 0) (INTEGER 0))" }
        ],
        "inputsInline": false,
        "previousStatement": null,
        "nextStatement": null,
        "colour": Blockly.Blocks.madeup.STATEMENT_HUE,
        "tooltip": "",
        "helpUrl": "http://www.example.com/",
        "sid": "mirror"
      },
    generator: generateCall
  },
  'madeup_look': {
    config:
      {
        "message0": "look view %1",
        "args0": [
          { "type": "input_value", "align": "RIGHT", "name": "view", "check": "Camera" }
        ],
        "inputsInline": false,
        "previousStatement": null,
        "nextStatement": null,
        "colour": Blockly.Blocks.madeup.STATEMENT_HUE,
        "tooltip": "",
        "helpUrl": "http://www.example.com/",
        "sid": "look"
      },
    generator: generateCall
  },
  'madeup_polarto': {
    config:
      {
        "message0": "polarto radius %1 angle %2 origin %3",
        "args0": [
          { "type": "input_value", "align": "RIGHT", "name": "radius", "check": ["Real", "Integer"] },
          { "type": "input_value", "align": "RIGHT", "name": "angle", "check": ["Real", "Integer"] },
          { "type": "input_value", "align": "RIGHT", "name": "origin", "check": "Array" },
        ],
        "inputsInline": false,
        "previousStatement": null,
        "nextStatement": null,
        "colour": Blockly.Blocks.madeup.STATEMENT_HUE,
        "tooltip": "",
        "helpUrl": "http://www.example.com/",
        "sid": "polarto"
      },
    generator: generateCall
  },
  'madeup_moveto': {
    config:
      {
        "message0": "moveto x %1 y %2 z %3",
        "args0": [
          { "type": "input_value", "align": "RIGHT", "name": "x", "check": ["Real", "Integer"] },
          { "type": "input_value", "align": "RIGHT", "name": "y", "check": ["Real", "Integer"] },
          { "type": "input_value", "align": "RIGHT", "name": "z", "check": ["Real", "Integer"], "default": "(REAL 1.0)" }
        ],
        "inputsInline": false,
        "previousStatement": null,
        "nextStatement": null,
        "colour": Blockly.Blocks.madeup.STATEMENT_HUE,
        "tooltip": "",
        "helpUrl": "http://www.example.com/",
        "sid": "moveto"
      },
    generator: generateCall
  },
  'madeup_moveto_xy': {
    config:
      {
        "message0": "moveto x %1 y %2",
        "args0": [
          { "type": "input_value", "align": "RIGHT", "name": "x", "check": ["Real", "Integer"] },
          { "type": "input_value", "align": "RIGHT", "name": "y", "check": ["Real", "Integer"] }
        ],
        "inputsInline": false,
        "previousStatement": null,
        "nextStatement": null,
        "colour": Blockly.Blocks.madeup.STATEMENT_HUE,
        "tooltip": "",
        "helpUrl": "http://www.example.com/"
      },
    generator: generateCall
  },
  'madeup_move': {
    config:
      {
        "message0": "move %1",
        "args0": [
          { "type": "input_value", "name": "distance", "check": ["Real", "Integer"] },
        ],
        "inputsInline": false,
        "previousStatement": null,
        "nextStatement": null,
        "colour": Blockly.Blocks.madeup.STATEMENT_HUE,
        "tooltip": "",
        "helpUrl": "http://www.example.com/",
        "sid": "move"
      },
    generator: generateCall
  },
  'madeup_turn': {
    config:
      {
        "message0": "%1 %2",
        "args0": [
          {
            "type": "field_dropdown",
            "name": "function",
            "options": [
              [ "yaw", "YAW" ],
              [ "pitch", "PITCH" ],
              [ "roll", "ROLL" ],
            ]
          },
          { "type": "input_value", "name": "degrees", "check": ["Real", "Integer"] },
        ],
        "inputsInline": false,
        "previousStatement": null,
        "nextStatement": null,
        "colour": Blockly.Blocks.madeup.STATEMENT_HUE,
        "tooltip": "",
        "helpUrl": "http://www.example.com/",
        "sid": ["yaw", "pitch", "roll"]
      },
    generator:
      function (block) {
        var value_degrees = Blockly.Madeup.valueToCode(block, 'degrees', Blockly.Madeup.ORDER_FUNCTION_CALL_ONLY_PARAMETER);
        var dropdown_type = block.getFieldValue('function');
        var code = dropdown_type.toLowerCase() + ' ' + value_degrees;
        return generateInMode(block, code, Blockly.Madeup.ORDER_ATOMIC);
      }
  },
  'madeup_sincostan': {
    config:
      {
        "message0": "%1 %2",
        "args0": [
          {
            "type": "field_dropdown",
            "name": "function",
            "options": [
              [ "sin", "SIN" ],
              [ "cos", "COS" ],
              [ "tan", "TAN" ],
            ]
          },
          { "type": "input_value", "name": "degrees", "check": ["Integer", "Real"] },
        ],
        "inputsInline": false,
        "output": ["Integer", "Real"],
        "colour": Blockly.Blocks.madeup.EXPRESSION_HUE,
        "tooltip": "",
        "helpUrl": "http://www.example.com/",
        "sid": ["sin", "cos", "tan"]
      },
    generator:
      function (block) {
        var value_degrees = Blockly.Madeup.valueToCode(block, 'degrees', Blockly.Madeup.ORDER_FUNCTION_CALL_ONLY_PARAMETER);
        var dropdown_f = block.getFieldValue('function');
        var code = dropdown_f.toLowerCase() + ' ' + value_degrees;
        return generateInMode(block, code, Blockly.Madeup.ORDER_FUNCTION_CALL);
      }
  },
  'madeup_inverse_sincostan': {
    config:
      {
        "message0": "%1 %2",
        "args0": [
          {
            "type": "field_dropdown",
            "name": "function",
            "options": [
              [ "asin", "ASIN" ],
              [ "acos", "ACOS" ],
              [ "atan", "ATAN" ],
            ]
          },
          { "type": "input_value", "name": "degrees", "check": ["Integer", "Real"] },
        ],
        "inputsInline": false,
        "output": ["Integer", "Real"],
        "colour": Blockly.Blocks.madeup.EXPRESSION_HUE,
        "tooltip": "",
        "helpUrl": "http://www.example.com/",
        "sid": ["asin", "acos", "atan"]
      },
    generator:
      function (block) {
        var value_ratio = Blockly.Madeup.valueToCode(block, 'ratio', Blockly.Madeup.ORDER_FUNCTION_CALL_ONLY_PARAMETER);
        var dropdown_f = block.getFieldValue('function');
        var code = dropdown_f.toLowerCase() + ' ' + value_ratio;
        return generateInMode(block, code, Blockly.Madeup.ORDER_FUNCTION_CALL);
      }
  },
  'madeup_binary_logic_operator': {
    config:
      {
        "message0": "%1 %2 %3",
        "args0": [
          { "type": "input_value", "name": "a", "check": ["Boolean"] },
          {
            "type": "field_dropdown",
            "name": "function",
            "options": [
              [ "and", "AND" ],
              [ "or", "OR" ],
            ]
          },
          { "type": "input_value", "name": "b", "check": ["Boolean"] }
        ],
        "inputsInline": true,
        "output": ["Boolean", "Mesh"],
        "colour": Blockly.Blocks.madeup.EXPRESSION_HUE,
        "tooltip": "",
        "helpUrl": "http://www.example.com/"
      },
    generator:
      function (block) {
        var dropdown_f = block.getFieldValue('function');
        var precedence;
        if (dropdown_f == 'and') {
          precedence = Blockly.Madeup.ORDER_LOGICAL_AND;
        } else {
          precedence = Blockly.Madeup.ORDER_LOGICAL_OR;
        }
        var value_a = Blockly.Madeup.valueToCode(block, 'a', precedence);
        var value_b = Blockly.Madeup.valueToCode(block, 'b', precedence);
        var code = value_a + ' ' + dropdown_f.toLowerCase() + ' ' + value_b;
        return generateInMode(block, code, precedence);
      }
  },
  'madeup_not': {
    config:
      {
        "message0": "not %1",
        "args0": [
          { "type": "input_value", "name": "a", "check": ["Boolean"] },
        ],
        "inputsInline": true,
        "output": ["Boolean"],
        "colour": Blockly.Blocks.madeup.EXPRESSION_HUE,
        "tooltip": "",
        "helpUrl": "http://www.example.com/"
      },
    generator:
      function (block) {
        var value_a = Blockly.Madeup.valueToCode(block, 'a', Blockly.Madeup.ORDER_LOGICAL_NOT);
        var code = 'not ' + value_a;
        return generateInMode(block, code, Blockly.Madeup.ORDER_LOGICAL_NOT);
      }
  },
  'madeup_identity': {
    config:
      {
        "message0": "identity",
        "previousStatement": null,
        "nextStatement": null,
        "colour": Blockly.Blocks.madeup.STATEMENT_HUE,
        "tooltip": "",
        "helpUrl": "http://www.example.com/",
        "sid": "identity"
      },
    generator: generateCall
  },
  'madeup_home': {
    config:
      {
        "message0": "home",
        "previousStatement": null,
        "nextStatement": null,
        "colour": Blockly.Blocks.madeup.STATEMENT_HUE,
        "tooltip": "",
        "helpUrl": "http://www.example.com/",
        "sid": "home"
      },
    generator: generateCall
  },
  'madeup_reframe': {
    config:
      {
        "message0": "reframe",
        "previousStatement": null,
        "nextStatement": null,
        "colour": Blockly.Blocks.madeup.STATEMENT_HUE,
        "tooltip": "",
        "helpUrl": "http://www.example.com/",
        "sid": "reframe"
      },
    generator: generateCall
  },
  'madeup_push': {
    config:
      {
        "message0": "push",
        "previousStatement": null,
        "nextStatement": null,
        "colour": Blockly.Blocks.madeup.STATEMENT_HUE,
        "tooltip": "",
        "helpUrl": "http://www.example.com/",
        "sid": "push"
      },
    generator: generateCall
  },
  'madeup_pop': {
    config:
      {
        "message0": "pop",
        "previousStatement": null,
        "nextStatement": null,
        "colour": Blockly.Blocks.madeup.STATEMENT_HUE,
        "tooltip": "",
        "helpUrl": "http://www.example.com/",
        "sid": "pop"
      },
    generator: generateCall
  },
  'madeup_reverse': {
    config:
      {
        "message0": "reverse",
        "inputsInline": true,
        "previousStatement": null,
        "nextStatement": null,
        "colour": Blockly.Blocks.madeup.STATEMENT_HUE,
        "tooltip": "",
        "helpUrl": "http://www.example.com/",
        "sid": "reverse"
      },
    generator: generateCall
  },
  'madeup_coalesce': {
    config:
      {
        "message0": "coalesce threshold %1",
        "args0": [
          { "type": "input_value", "name": "threshold", "check": ["Integer", "Real"] },
        ],
        "inputsInline": false,
        "previousStatement": null,
        "nextStatement": null,
        "colour": Blockly.Blocks.madeup.STATEMENT_HUE,
        "tooltip": "",
        "helpUrl": "http://www.example.com/",
        "sid": "coalesce"
      },
    generator: generateCall
  },
  'madeup_dilate': {
    config:
      {
        "message0": "dilate path %1 distance %2",
        "args0": [
          { "type": "input_value", "align": "RIGHT", "name": "path", "check": ["Path"] },
          { "type": "input_value", "align": "RIGHT", "name": "distance", "check": ['Integer', 'Real'] },
        ],
        "inputsInline": false,
        "previousStatement": null,
        "nextStatement": null,
        "colour": Blockly.Blocks.madeup.STATEMENT_HUE,
        "tooltip": "",
        "helpUrl": "http://www.example.com/",
        "sid": "dilate"
      },
    generator: generateCall
  },
  'madeup_loft': {
    config:
      {
        "message0": "loft paths %1",
        "args0": [
          { "type": "input_value", "align": "RIGHT", "name": "paths", "check": ["Array"] },
        ],
        "inputsInline": false,
        "previousStatement": null,
        "nextStatement": null,
        "colour": Blockly.Blocks.madeup.STATEMENT_HUE,
        "tooltip": "",
        "helpUrl": "http://www.example.com/",
        "sid": "loft"
      },
    generator: generateCall
  },
  'madeup_dowel': {
    config:
      {
        "message0": "dowel maxBend %1 twist %2",
        "args0": [
          { "type": "input_value", "align": "RIGHT", "name": "maxBend", "check": ["Real", "Integer"], "default": "(INTEGER 360)" },
          { "type": "input_value", "align": "RIGHT", "name": "twist", "check": ["Real", "Integer"], "default": "(INTEGER 45)" },
        ],
        "inputsInline": false,
        "previousStatement": null,
        "nextStatement": null,
        "colour": Blockly.Blocks.madeup.STATEMENT_HUE,
        "tooltip": "",
        "helpUrl": "http://www.example.com/",
        "sid": "dowel"
      },
    generator: generateCall
  },
  'madeup_return': {
    config:
      {
        "message0": "return %1",
        "args0": [
          { "type": "input_value", "align": "RIGHT", "name": "value" },
        ],
        "inputsInline": true,
        "previousStatement": null,
        "nextStatement": null,
        "colour": Blockly.Blocks.madeup.STATEMENT_HUE,
        "tooltip": "",
        "helpUrl": "http://www.example.com/"
      },
    generator: generateCall
  },
  'madeup_echo': {
    config:
      {
        "message0": "echo %1",
        "args0": [
          { "type": "input_value", "align": "RIGHT", "name": "object", "check": ["Path", "Mesh"] },
        ],
        "inputsInline": true,
        "previousStatement": null,
        "nextStatement": null,
        "colour": Blockly.Blocks.madeup.STATEMENT_HUE,
        "tooltip": "",
        "helpUrl": "http://www.example.com/",
        "sid": "echo"
      },
    generator: generateCall
  },
  'madeup_transform': {
    config:
      {
        "message0": "transform %1",
        "args0": [
          { "type": "input_value", "align": "RIGHT", "name": "object", "check": ["Path", "Mesh"] },
        ],
        "inputsInline": true,
        "previousStatement": null,
        "nextStatement": null,
        "colour": Blockly.Blocks.madeup.STATEMENT_HUE,
        "tooltip": "",
        "helpUrl": "http://www.example.com/",
        "sid": "transform"
      },
    generator: generateCall
  },
  'madeup_path': {
    config:
      {
        "message0": "path",
        "previousStatement": null,
        "nextStatement": null,
        "colour": Blockly.Blocks.madeup.STATEMENT_HUE,
        "tooltip": "",
        "helpUrl": "http://www.example.com/",
        "sid": "path"
      },
    generator: generateCall
  },
  'madeup_mode_add': {
    config:
      {
        "message0": "add",
        "previousStatement": null,
        "nextStatement": null,
        "colour": Blockly.Blocks.madeup.STATEMENT_HUE,
        "tooltip": "",
        "helpUrl": "http://www.example.com/",
        "sid": "add"
      },
    generator: generateCall
  },
  'madeup_mode_subtract': {
    config:
      {
        "message0": "subtract",
        "previousStatement": null,
        "nextStatement": null,
        "colour": Blockly.Blocks.madeup.STATEMENT_HUE,
        "tooltip": "",
        "helpUrl": "http://www.example.com/",
        "sid": "subtract"
      },
    generator: generateCall
  },
  'madeup_trimesh': {
    config:
      {
        "message0": "trimesh vertices %1 faces %2",
        "args0": [
          { "type": "input_value", "align": "RIGHT", "name": "vertices", "check": "Array" },
          { "type": "input_value", "align": "RIGHT", "name": "faces", "check": "Array" },
        ],
        "inputsInline": false,
        "previousStatement": null,
        "nextStatement": null,
        "colour": Blockly.Blocks.madeup.STATEMENT_HUE,
        "tooltip": "",
        "helpUrl": "http://www.example.com/",
        "sid": "trimesh"
      },
    generator: generateCall
  },
  'madeup_surface': {
    config:
      {
        "message0": "surface columns %1 rows %2",
        "args0": [
          { "type": "input_value", "align": "RIGHT", "name": "columns", "check": "Integer" },
          { "type": "input_value", "align": "RIGHT", "name": "rows", "check": "Integer" },
        ],
        "inputsInline": false,
        "previousStatement": null,
        "nextStatement": null,
        "colour": Blockly.Blocks.madeup.STATEMENT_HUE,
        "tooltip": "",
        "helpUrl": "http://www.example.com/",
        "sid": "surface"
      },
    generator: generateCall
  },
  'madeup_view': {
    config:
      {
        "message0": "view",
        "inputsInline": true,
        "output": "Camera",
        "colour": Blockly.Blocks.madeup.EXPRESSION_HUE,
        "tooltip": "",
        "helpUrl": "http://www.example.com/",
        "sid": "view"
      },
    generator: generateCall
  },
  'madeup_where': {
    config:
      {
        "message0": "where",
        "inputsInline": true,
        "output": "Array",
        "colour": Blockly.Blocks.madeup.EXPRESSION_HUE,
        "tooltip": "",
        "helpUrl": "http://www.example.com/",
        "sid": "where"
      },
    generator: generateCall
  },
  'madeup_repeat': {
    config: 
      {
        "message0": "repeat %1 %2",
        "args0": [
          { "type": "input_value", "name": "count", "check": "Integer" },
          { "type": "input_statement", "name": "body" }
        ],
        "inputsInline": true,
        "previousStatement": null,
        "nextStatement": null,
        "colour": Blockly.Blocks.madeup.STATEMENT_HUE,
        "tooltip": "",
        "helpUrl": "http://www.example.com/"
      },
    generator:
      function(block) {
        var value_count = Blockly.Madeup.valueToCode(block, 'count', Blockly.Madeup.ORDER_NONE);
        var statements_block = Blockly.Madeup.statementToCode(block, 'body');
        var code = 'repeat ' + value_count + '\n' + statements_block + 'end';
        return generateInMode(block, code, Blockly.Madeup.ORDER_ATOMIC);
      }
  },
  'madeup_repeat_around': {
    config:
      {
        "message0": "repeat %1 %2 around %3",
        "args0": [
          { "type": "input_value", "name": "count", "check": "Integer" },
          { "type": "input_statement", "name": "surrounder" },
          { "type": "input_statement", "name": "surroundee" }
        ],
        "inputsInline": true,
        "previousStatement": null,
        "nextStatement": null,
        "colour": Blockly.Blocks.madeup.STATEMENT_HUE,
        "tooltip": "",
        "helpUrl": "http://www.example.com/"
      },
    generator:
      function(block) {
        var value_count = Blockly.Madeup.valueToCode(block, 'count', Blockly.Madeup.ORDER_NONE);
        var surrounder_block = Blockly.Madeup.statementToCode(block, 'surrounder');
        var surroundee_block = Blockly.Madeup.statementToCode(block, 'surroundee');
        var code = 'repeat ' + value_count + '\n' + surrounder_block + '\naround\n' + surroundee_block + 'end';
        return generateInMode(block, code, Blockly.Madeup.ORDER_ATOMIC);
      }
  },
  'madeup_while': {
    config:
      {
        "message0": "while %1 %2",
        "args0": [
          { "type": "input_value", "name": "condition", "check": "Boolean" },
          { "type": "input_statement", "name": "body" },
        ],
        "inputsInline": true,
        "previousStatement": null,
        "nextStatement": null,
        "colour": Blockly.Blocks.madeup.STATEMENT_HUE,
        "tooltip": "",
        "helpUrl": "http://www.example.com/"
      },
    generator:
      function(block) {
        var value_condition = Blockly.Madeup.valueToCode(block, 'condition', Blockly.Madeup.ORDER_NONE);
        var statements_body = Blockly.Madeup.statementToCode(block, 'body');
        var code = 'while ' + value_condition + '\n' + statements_body + 'end';
        return generateInMode(block, code, Blockly.Madeup.ORDER_ATOMIC);
      }
  },
  'madeup_for_upper': {
    config: 
      {
        "message0": "for %1 %2 %3 %4",
        "args0": [
          { "type": "input_value", "name": "iterator" },
          {
            "type": "field_dropdown",
            "name": "clusivity",
            "options": [
              [ "to", "TO" ],
              [ "through", "through" ],
            ]
          },
          { "type": "input_value", "name": "stop", "check": "Integer" },
          { "type": "input_statement", "name": "body" },
        ],
        "inputsInline": true,
        "previousStatement": null,
        "nextStatement": null,
        "colour": Blockly.Blocks.madeup.STATEMENT_HUE,
        "tooltip": "",
        "helpUrl": "http://www.example.com/"
      },
    generator: 
      function(block) {
        var value_stop = Blockly.Madeup.valueToCode(block, 'stop', Blockly.Madeup.ORDER_NONE);
        var iterator = Blockly.Madeup.valueToCode(block, 'iterator', Blockly.Madeup.ORDER_NONE);
        var clusivity = block.getFieldValue('clusivity').toLowerCase();
        var statements_body = Blockly.Madeup.statementToCode(block, 'body');
        var code = 'for ' + iterator + ' ' + clusivity + ' ' + value_stop + '\n' + statements_body + 'end';
        return generateInMode(block, code, Blockly.Madeup.ORDER_ATOMIC);
      }
  },
  'madeup_for_upper_by': {
    config: 
      {
        "message0": "for %1 %2 %3 by %4 %5",
        "args0": [
          { "type": "input_value", "name": "iterator" },
          {
            "type": "field_dropdown",
            "name": "clusivity",
            "options": [
              [ "to", "TO" ],
              [ "through", "through" ],
            ]
          },
          { "type": "input_value", "name": "stop", "check": "Integer" },
          { "type": "input_value", "name": "by", "check": "Integer" },
          { "type": "input_statement", "name": "body" },
        ],
        "inputsInline": true,
        "previousStatement": null,
        "nextStatement": null,
        "colour": Blockly.Blocks.madeup.STATEMENT_HUE,
        "tooltip": "",
        "helpUrl": "http://www.example.com/"
      },
    generator: 
      function(block) {
        var value_stop = Blockly.Madeup.valueToCode(block, 'stop', Blockly.Madeup.ORDER_NONE);
        var iterator = Blockly.Madeup.valueToCode(block, 'iterator', Blockly.Madeup.ORDER_NONE);
        var value_by = Blockly.Madeup.valueToCode(block, 'by', Blockly.Madeup.ORDER_NONE);
        var clusivity = block.getFieldValue('clusivity').toLowerCase();
        var statements_body = Blockly.Madeup.statementToCode(block, 'body');
        var code = 'for ' + iterator + ' ' + clusivity + ' ' + value_stop + ' by ' + value_by + '\n' + statements_body + 'end';
        return generateInMode(block, code, Blockly.Madeup.ORDER_ATOMIC);
      }
  },
  'madeup_for_in': {
    config: 
      {
        "message0": "for %1 in %2 .. %3 %4",
        "args0": [
          { "type": "input_value", "name": "iterator" },
          { "type": "input_value", "name": "start", "check": "Integer" },
          { "type": "input_value", "name": "stop", "check": "Integer" },
          { "type": "input_statement", "name": "body" },
        ],
        "inputsInline": true,
        "previousStatement": null,
        "nextStatement": null,
        "colour": Blockly.Blocks.madeup.STATEMENT_HUE,
        "tooltip": "",
        "helpUrl": "http://www.example.com/"
      },
    generator: 
      function(block) {
        var value_start = Blockly.Madeup.valueToCode(block, 'start', Blockly.Madeup.ORDER_NONE);
        var value_stop = Blockly.Madeup.valueToCode(block, 'stop', Blockly.Madeup.ORDER_NONE);
        var iterator = Blockly.Madeup.valueToCode(block, 'iterator', Blockly.Madeup.ORDER_NONE);
        var statements_body = Blockly.Madeup.statementToCode(block, 'body');
        var code = 'for ' + iterator + ' in ' + value_start + '..' + value_stop + '\n' + statements_body + 'end';
        return generateInMode(block, code, Blockly.Madeup.ORDER_ATOMIC);
      }
  },
  'madeup_for_in_by': {
    config: 
      {
        "message0": "for %1 in %2 .. %3 by %4 %5",
        "args0": [
          { "type": "input_value", "name": "iterator" },
          { "type": "input_value", "name": "start", "check": "Integer" },
          { "type": "input_value", "name": "stop", "check": "Integer" },
          { "type": "input_value", "name": "by", "check": "Integer" },
          { "type": "input_statement", "name": "body" },
        ],
        "inputsInline": true,
        "previousStatement": null,
        "nextStatement": null,
        "colour": Blockly.Blocks.madeup.STATEMENT_HUE,
        "tooltip": "",
        "helpUrl": "http://www.example.com/"
      },
    generator: 
      function(block) {
        var value_start = Blockly.Madeup.valueToCode(block, 'start', Blockly.Madeup.ORDER_NONE);
        var value_stop = Blockly.Madeup.valueToCode(block, 'stop', Blockly.Madeup.ORDER_NONE);
        var iterator = Blockly.Madeup.valueToCode(block, 'iterator', Blockly.Madeup.ORDER_NONE);
        var value_by = Blockly.Madeup.valueToCode(block, 'by', Blockly.Madeup.ORDER_NONE);
        var statements_body = Blockly.Madeup.statementToCode(block, 'body');
        var code = 'for ' + iterator + ' in ' + value_start + '..' + value_stop + ' by ' + value_by + '\n' + statements_body + 'end';
        return generateInMode(block, code, Blockly.Madeup.ORDER_ATOMIC);
      }
  },
  'madeup_array_by': {
    config:
      {
        "message0": "%1 by %2",
        "args0": [
          { "type": "input_value", "align": "RIGHT", "name": "n", "check": ["Integer"] },
          { "type": "input_value", "align": "RIGHT", "name": "item" }
        ],
        "inputsInline": true,
        "output": "Array",
        "colour": Blockly.Blocks.madeup.EXPRESSION_HUE,
        "tooltip": "",
        "helpUrl": "http://www.example.com/"
      },
    generator:
      function(block) {
        var value_outer = Blockly.Madeup.valueToCode(block, 'n', Blockly.Madeup.ORDER_ARRAY_BY);
        var value_inner = Blockly.Madeup.valueToCode(block, 'item', Blockly.Madeup.ORDER_ARRAY_BY);
        var code = value_outer + ' by ' + value_inner;
        return generateInMode(block, code, Blockly.Madeup.ORDER_ARRAY_BY);
      }
  },
  'madeup_array_of': {
    config:
      {
        "message0": "%1 of %2",
        "args0": [
          { "type": "input_value", "align": "RIGHT", "name": "n", "check": ["Integer"] },
          { "type": "input_value", "align": "RIGHT", "name": "item" }
        ],
        "inputsInline": true,
        "output": "Array",
        "colour": Blockly.Blocks.madeup.EXPRESSION_HUE,
        "tooltip": "",
        "helpUrl": "http://www.example.com/"
      },
    generator:
      function(block) {
        var value_outer = Blockly.Madeup.valueToCode(block, 'n', Blockly.Madeup.ORDER_ARRAY_BY);
        var value_inner = Blockly.Madeup.valueToCode(block, 'item', Blockly.Madeup.ORDER_ARRAY_BY);
        var code = value_outer + ' of ' + value_inner;
        return generateInMode(block, code, Blockly.Madeup.ORDER_ARRAY_OF);
      }
  },
  'madeup_cross': {
    config:
      {
        "message0": "%1 cross %2",
        "args0": [
          { "type": "input_value", "align": "RIGHT", "name": "a", "check": "Array" },
          { "type": "input_value", "align": "RIGHT", "name": "b", "check": "Array" }
        ],
        "inputsInline": true,
        "output": "Array",
        "colour": Blockly.Blocks.madeup.EXPRESSION_HUE,
        "tooltip": "",
        "helpUrl": "http://www.example.com/",
        "sid": "cross"
      },
    generator: generateCall
  },
  'madeup_dot': {
    config:
      {
        "message0": "%1 dot %2",
        "args0": [
          { "type": "input_value", "align": "RIGHT", "name": "a", "check": "Array" },
          { "type": "input_value", "align": "RIGHT", "name": "b", "check": "Array" }
        ],
        "inputsInline": true,
        "output": "Array",
        "colour": Blockly.Blocks.madeup.EXPRESSION_HUE,
        "tooltip": "",
        "helpUrl": "http://www.example.com/",
        "sid": "dot"
      },
    generator: generateCall
  },
  'madeup_size': {
    config:
      {
        "message0": "size %1",
        "args0": [
          { "type": "input_value", "align": "RIGHT", "name": "a", "check": ["Array", "String"] },
        ],
        "inputsInline": true,
        "output": "Integer",
        "colour": Blockly.Blocks.madeup.EXPRESSION_HUE,
        "tooltip": "",
        "helpUrl": "http://www.example.com/",
        "sid": "size"
      },
    generator: generateCall
  },
  'madeup_magnitude': {
    config:
      {
        "message0": "magnitude %1",
        "args0": [
          { "type": "input_value", "align": "RIGHT", "name": "vector", "check": "Array" },
        ],
        "inputsInline": true,
        "output": "Real",
        "colour": Blockly.Blocks.madeup.EXPRESSION_HUE,
        "tooltip": "",
        "helpUrl": "http://www.example.com/",
        "sid": "magnitude"
      },
    generator: generateCall
  },
  'madeup_normalize': {
    config:
      {
        "message0": "normalize %1",
        "args0": [
          { "type": "input_value", "align": "RIGHT", "name": "vector", "check": "Array" },
        ],
        "inputsInline": true,
        "output": "Array",
        "colour": Blockly.Blocks.madeup.EXPRESSION_HUE,
        "tooltip": "",
        "helpUrl": "http://www.example.com/",
        "sid": "normalize"
      },
    generator: generateCall
  },
  'madeup_subscript': {
    config:
      {
        "message0": "item %1 of %2",
        "args0": [
          { "type": "input_value", "align": "RIGHT", "name": "i", "check": "Integer" },
          { "type": "input_value", "align": "RIGHT", "name": "collection", "check": "Array" },
        ],
        "inputsInline": true,
        "output": null,
        "colour": Blockly.Blocks.madeup.EXPRESSION_HUE,
        "tooltip": "",
        "helpUrl": "http://www.example.com/"
      },
    generator:
      function(block) {
        var value_i = Blockly.Madeup.valueToCode(block, 'i', Blockly.Madeup.ORDER_ATOMIC);
        var value_collection = Blockly.Madeup.valueToCode(block, 'collection', Blockly.Madeup.ORDER_ATOMIC);
        var code = value_collection + '[' + value_i + ']';
        return generateInMode(block, code, Blockly.Madeup.ORDER_ATOMIC);
      }
  },
  'madeup_subscript_set': {
    config:
      {
        "message0": "set item %1 of %2 to %3",
        "args0": [
          { "type": "input_value", "align": "RIGHT", "name": "i", "check": "Integer" },
          { "type": "input_value", "align": "RIGHT", "name": "collection", "check": "Array" },
          { "type": "input_value", "align": "RIGHT", "name": "rhs" },
        ],
        "inputsInline": true,
        "previousStatement": null,
        "nextStatement": null,
        "colour": Blockly.Blocks.madeup.STATEMENT_HUE,
        "tooltip": "",
        "helpUrl": "http://www.example.com/"
      },
    generator:
      function(block) {
        var value_i = Blockly.Madeup.valueToCode(block, 'i', Blockly.Madeup.ORDER_ATOMIC);
        var value_collection = Blockly.Madeup.valueToCode(block, 'collection', Blockly.Madeup.ORDER_ATOMIC);
        var value_rhs = Blockly.Madeup.valueToCode(block, 'rhs', Blockly.Madeup.ORDER_ATOMIC);
        var code = value_collection + '[' + value_i + '] = ' + value_rhs;
        return generateInMode(block, code, Blockly.Madeup.ORDER_ATOMIC);
      }
  },
  'madeup_subrange': {
    config:
      {
        "message0": "items %1 through %2 of %3",
        "args0": [
          { "type": "input_value", "align": "RIGHT", "name": "i", "check": "Integer" },
          { "type": "input_value", "align": "RIGHT", "name": "j", "check": "Integer" },
          { "type": "input_value", "align": "RIGHT", "name": "collection", "check": "Array" },
        ],
        "inputsInline": true,
        "output": "Array",
        "colour": Blockly.Blocks.madeup.EXPRESSION_HUE,
        "tooltip": "",
        "helpUrl": "http://www.example.com/"
      },
    generator:
      function(block) {
        var value_i = Blockly.Madeup.valueToCode(block, 'i', Blockly.Madeup.ORDER_ATOMIC);
        var value_j = Blockly.Madeup.valueToCode(block, 'j', Blockly.Madeup.ORDER_ATOMIC);
        var value_collection = Blockly.Madeup.valueToCode(block, 'collection', Blockly.Madeup.ORDER_ATOMIC);
        var code = value_collection + '[' + value_i + '..' + value_j + ']';
        return generateInMode(block, code, Blockly.Madeup.ORDER_ATOMIC);
      }
  },
}

// --------------------------------------------------------------------------- 

for (var type in blockDefinitions) {
  if (blockDefinitions.hasOwnProperty(type)) {
    (function (type, config) {
      Blockly.Blocks[type] = {
        init: function() {
          this.jsonInit(config);
          this.madeup = {
            formals: config.args0,
            message: config.message0
          };
        },
        customContextMenu: contextMenuPlusPlus,
        mutationToDom: mutationToDom,
        domToMutation: domModeToMutation
      };
    })(type, blockDefinitions[type].config);
  }
}

// ----------------------------------------------------------------------------

Blockly.Blocks['madeup_array_literal'] = {
  /**
   * Block for creating a list with any number of elements of any type.
   * @this Blockly.Block
   */
  init: function() {
    // this.setHelpUrl(Blockly.Msg.LISTS_CREATE_WITH_HELPURL);
    this.setColour(Blockly.Blocks.madeup.EXPRESSION_HUE);
    this.itemCount_ = 3;
    this.updateShape_();
    this.setOutput(true, 'Array');
    this.setMutator(new Blockly.Mutator(['madeup_array_element']));
    this.setTooltip(Blockly.Msg.LISTS_CREATE_WITH_TOOLTIP);
  },
  /**
   * Create XML to represent list inputs.
   * @return {!Element} XML storage element.
   * @this Blockly.Block
   */
  mutationToDom: function() {
    var container = document.createElement('mutation');
    container.setAttribute('items', this.itemCount_);
    mutationModeToDom(this, container);
    return container;
  },
  /**
   * Parse XML to restore the list inputs.
   * @param {!Element} xmlElement XML storage element.
   * @this Blockly.Block
   */
  domToMutation: function(xmlElement) {
    this.itemCount_ = parseInt(xmlElement.getAttribute('items'), 10);
    this.updateShape_();
    domModeToMutation.call(this, xmlElement);
  },
  /**
   * Populate the mutator's dialog with this block's components.
   * @param {!Blockly.Workspace} workspace Mutator's workspace.
   * @return {!Blockly.Block} Root block in mutator.
   * @this Blockly.Block
   */
  decompose: function(workspace) {
    var containerBlock = workspace.newBlock('madeup_array_create_with_container');
    containerBlock.initSvg();
    var connection = containerBlock.getInput('stack').connection;
    for (var i = 0; i < this.itemCount_; i++) {
      var itemBlock = workspace.newBlock('madeup_array_element');
      itemBlock.initSvg();
      connection.connect(itemBlock.previousConnection);
      connection = itemBlock.nextConnection;
    }
    return containerBlock;
  },
  /**
   * Reconfigure this block based on the mutator dialog's components.
   * @param {!Blockly.Block} containerBlock Root block in mutator.
   * @this Blockly.Block
   */
  compose: function(containerBlock) {
    var itemBlock = containerBlock.getInputTargetBlock('stack');
    // Count number of inputs.
    var connections = [];
    while (itemBlock) {
      connections.push(itemBlock.valueConnection_);
      itemBlock = itemBlock.nextConnection && itemBlock.nextConnection.targetBlock();
    }
    // Disconnect any children that don't belong.
    for (var i = 0; i < this.itemCount_; i++) {
      var connection = this.getInput('element' + i).connection.targetConnection;
      if (connection && connections.indexOf(connection) == -1) {
        connection.disconnect();
      }
    }
    this.itemCount_ = connections.length;
    this.updateShape_();
    // Reconnect any child blocks.
    for (var i = 0; i < this.itemCount_; i++) {
      Blockly.Mutator.reconnect(connections[i], this, 'element' + i);
    }
  },
  /**
   * Store pointers to any connected child blocks.
   * @param {!Blockly.Block} containerBlock Root block in mutator.
   * @this Blockly.Block
   */
  saveConnections: function(containerBlock) {
    var itemBlock = containerBlock.getInputTargetBlock('stack');
    var i = 0;
    while (itemBlock) {
      var input = this.getInput('element' + i);
      itemBlock.valueConnection_ = input && input.connection.targetConnection;
      i++;
      itemBlock = itemBlock.nextConnection && itemBlock.nextConnection.targetBlock();
    }
  },
  /**
   * Modify this block to have the correct number of inputs.
   * @private
   * @this Blockly.Block
   */
  updateShape_: function() {
    if (this.itemCount_ && this.getInput('empty')) {
      this.removeInput('empty');
    } else if (!this.itemCount_ && !this.getInput('empty')) {
      this.appendDummyInput('empty')
          .appendField(Blockly.Msg.LISTS_CREATE_EMPTY_TITLE);
    }
    // ELEMENT new inputs.
    for (var i = 0; i < this.itemCount_; i++) {
      if (!this.getInput('element' + i)) {
        var input = this.appendValueInput('element' + i);
        if (i == 0) {
          input.appendField('array');
        }
      }
    }
    // Remove deleted inputs.
    while (this.getInput('element' + i)) {
      this.removeInput('element' + i);
      i++;
    }
  },
  customContextMenu: contextMenuPlusPlus,
  // mutationToDom: mutationToDom,
  // domToMutation: domModeToMutation
};

Blockly.Blocks['madeup_array_create_with_container'] = {
  /**
   * Mutator block for list container.
   * @this Blockly.Block
   */
  init: function() {
    this.setColour(Blockly.Blocks.lists.HUE);
    this.appendDummyInput()
        .appendField('array');
    this.appendStatementInput('stack');
    this.contextMenu = false;
  },
  customContextMenu: contextMenuPlusPlus,
  mutationToDom: mutationToDom,
  domToMutation: domModeToMutation
};

Blockly.Blocks['madeup_array_element'] = {
  init: function() {
    this.setColour(Blockly.Blocks.lists.HUE);
    this.appendDummyInput()
        .appendField('element');
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    // this.setTooltip(Blockly.Msg.LISTS_CREATE_WITH_ITEM_TOOLTIP);
    this.contextMenu = false;
  },
  customContextMenu: contextMenuPlusPlus,
  mutationToDom: mutationToDom,
  domToMutation: domModeToMutation
};


// ----------------------------------------------------------------------------
// Remove the return blocks that Blockly automatically generates in the
// PROCEDURES node of the toolbox. Madeup doesn't support explicit return
// statements.
delete Blockly.Blocks.procedures_defreturn;
delete Blockly.Blocks.procedures_ifreturn;

// When you create a new variable, Blockly wants to create a setter, an rvalue,
// and a changer. We don't want the changer.
// Blockly.Blocks['math_change'] = null;
delete Blockly.Blocks.math_change;

function customizeBlock(id, hue) {
  var oldInitializer = Blockly.Blocks[id].init;
  Blockly.Blocks[id].init = function() {
    oldInitializer.call(this);
    this.setColour(hue);

    var oldContextMenu = this.customContextMenu;
    this.customContextMenu = function(options) {
      oldContextMenu.call(this, options);
      contextMenuPlusPlus.call(this, options);
    };

    var oldDomToMutation = Blockly.Blocks[id].domToMutation;
    this.domToMutation = function(xmlElement) {
      oldDomToMutation.call(this, xmlElement);
      domModeToMutation.call(this, xmlElement);
    };

    // Not every block has a mutation.
    var oldMutationToDom = Blockly.Blocks[id].mutationToDom;
    if (oldMutationToDom) {
      this.mutationToDom = function() {
        var container = oldMutationToDom.call(this);
        mutationModeToDom(this, container);
        return container;
      };
    }

    // TODO: remove non-enabled defaults here?
  }
}

customizeBlock('variables_get', Blockly.Blocks.madeup.EXPRESSION_HUE);
customizeBlock('variables_set', Blockly.Blocks.madeup.STATEMENT_HUE);
customizeBlock('procedures_defnoreturn', Blockly.Blocks.madeup.STATEMENT_HUE);
customizeBlock('procedures_callnoreturn', Blockly.Blocks.madeup.STATEMENT_HUE);

function addStatementConnectors(id) {
  var oldInitializer = Blockly.Blocks[id].init;
  Blockly.Blocks[id].init = function() {
    oldInitializer.call(this);
    this.setNextStatement(true);
    this.setPreviousStatement(true);
  }
}
addStatementConnectors('procedures_defnoreturn');
