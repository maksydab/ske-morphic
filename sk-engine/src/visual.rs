use crate::data::*;
use crate::engine::Instance;
use crate::log_to_js;
use std::collections::HashMap;
//the how the nodes look in getnodeblueprint
//how "action" nodes work in execute
//how prop ndoes work in evaluatepinvaluer 
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum DataType {
    Flow,
    Int,
    Float,
    String,
    Bool,
    List,
    Any,
}

#[derive(Clone, Debug, PartialEq)]
pub enum Pintype {
    Flow,
    Data,
}

#[derive(Clone, Debug)]
pub struct Pin {
    pub id: String,
    pub pintype: Pintype,
    pub expected_types: Vec<DataType>,
    pub value: Option<Valuer>,
    pub connectedto: Option<(usize, String)>,
}

impl Pin {
    pub fn accepts(&self, valuer: &Valuer) -> bool {
        if self.expected_types.contains(&DataType::Any) {
            return true;
        }

        for dt in &self.expected_types {
            match (dt, valuer) {
                (DataType::Int, Valuer::Int(_)) => return true,
                (DataType::Float, Valuer::Float(_)) => return true,
                (DataType::String, Valuer::String(_)) => return true,
                (DataType::Bool, Valuer::Bool(_)) => return true,
                (DataType::List, Valuer::List(_)) => return true,
                _ => {}
            }
        }
        false
    }
}

#[derive(Clone, Debug)]
pub struct NonStart {}

#[derive(Clone, Debug)]
pub struct Nmove {}

#[derive(Clone, Debug)]
pub struct NonClick {}

#[derive(Clone, Debug)]
pub struct Nif {}

#[derive(Clone, Debug)]
pub struct Nadd {}
#[derive(Clone, Debug)]
pub struct NgetProp {}
#[derive(Clone, Debug)]
pub enum Nodeprops {
    NonStart(NonStart),
    Nmove(Nmove),
    NonClick(NonClick),
    Nif(Nif),
    Nadd(Nadd),
    NgetProp(NgetProp),
}

impl Nodeprops {
    pub fn execute(&self, instance: &mut Instance, allnodes: &[Noder]) -> Vec<usize> {
        let currentnode = allnodes
            .iter()
            .find(|n| match (&n.props, self) {
                (Nodeprops::NonStart(_), Nodeprops::NonStart(_)) => true,
                (Nodeprops::Nmove(_), Nodeprops::Nmove(_)) => true,
                (Nodeprops::NonClick(_), Nodeprops::NonClick(_)) => true,
                (Nodeprops::Nif(_), Nodeprops::Nif(_)) => true,
                (Nodeprops::Nadd(_), Nodeprops::Nadd(_)) => true,
                (Nodeprops::NgetProp(_), Nodeprops::NgetProp(_)) => true,
                _ => false,
            })
            .expect("node context error");
        match self {
            Nodeprops::NonStart(_) => {
                log_to_js("start node triggered");
                getconnectedflowoutputs(currentnode, "flowout")
            }
            Nodeprops::Nmove(_) => {
                let moveval = evaluatedatapinfloat(allnodes, currentnode, "by", instance);
                instance.x += moveval;
                log_to_js(&format!("[{}] moved  x: {}", instance.n, instance.x));
                getconnectedflowoutputs(currentnode, "flowout")
            }
            Nodeprops::NonClick(_) => {
                log_to_js(&format!("[{}] click ***", instance.n));
                getconnectedflowoutputs(currentnode, "flowout")
            }
            Nodeprops::Nif(_) => {
                let conditiontrue = evaluatedatapinbool(allnodes, currentnode, "condition", instance);
                if conditiontrue {
                    log_to_js("If condition: true");
                    getconnectedflowoutputs(currentnode, "true")
                } else {
                    log_to_js("If condition: false");
                    getconnectedflowoutputs(currentnode, "false")
                }
            }
            Nodeprops::Nadd(_) => {
                let _addval = evaluatedatapinfloat(allnodes, currentnode, "a", instance);
                getconnectedflowoutputs(currentnode, "flowout")
            }
            Nodeprops::NgetProp(_) => {
                getconnectedflowoutputs(currentnode, "flowout")
            }
        }
    }
}

pub fn getconnectedflowoutputs(node: &Noder, pinid: &str) -> Vec<usize> {
    node.outputs
        .iter()
        .filter(|p| p.pintype == Pintype::Flow && p.id == pinid)
        .filter_map(|p| p.connectedto.as_ref().map(|(targetidx, _)| *targetidx))
        .collect()
}

#[derive(Clone, Debug)]
pub struct Noder {
    pub id: usize,
    pub ty: i64,
    pub inputs: Vec<Pin>,
    pub outputs: Vec<Pin>,
    pub props: Nodeprops,
}

#[derive(Clone)]
pub struct Visualprop {
    pub vars: HashMap<String, Var>,
    pub nodes: Vec<Noder>,
}

fn getnodeblueprint(tstr: &str) -> (i64, Nodeprops, Vec<Pin>, Vec<Pin>) {
    match tstr {
        "onStart" => (
            0,
            Nodeprops::NonStart(NonStart {}),
            vec![],
            vec![Pin {
                id: "flowout".to_string(),
                pintype: Pintype::Flow,
                expected_types: vec![DataType::Flow],
                value: None,
                connectedto: None,
            }],
        ),
        "move" => (
            1,
            Nodeprops::Nmove(Nmove {}),
            vec![
                Pin {
                    id: "flowin".to_string(),
                    pintype: Pintype::Flow,
                    expected_types: vec![DataType::Flow],
                    value: None,
                    connectedto: None,
                },
                Pin {
                    id: "by".to_string(),
                    pintype: Pintype::Data,
                    expected_types: vec![DataType::Int, DataType::Float],
                    value: Some(Valuer::Float(1.0)),
                    connectedto: None,
                },
            ],
            vec![Pin {
                id: "flowout".to_string(),
                pintype: Pintype::Flow,
                expected_types: vec![DataType::Flow],
                value: None,
                connectedto: None,
            }],
        ),
        "onClick" => (
            2,
            Nodeprops::NonClick(NonClick {}),
            vec![],
            vec![Pin {
                id: "flowout".to_string(),
                pintype: Pintype::Flow,
                expected_types: vec![DataType::Flow],
                value: None,
                connectedto: None,
            }],
        ),
        "if" => (
            3,
            Nodeprops::Nif(Nif {}),
            vec![
                Pin {
                    id: "flowin".to_string(),
                    pintype: Pintype::Flow,
                    expected_types: vec![DataType::Flow],
                    value: None,
                    connectedto: None,
                },
                Pin {
                    id: "condition".to_string(),
                    pintype: Pintype::Data,
                    expected_types: vec![DataType::Bool],
                    value: Some(Valuer::Bool(true)),
                    connectedto: None,
                },
            ],
            vec![
                Pin {
                    id: "true".to_string(),
                    pintype: Pintype::Flow,
                    expected_types: vec![DataType::Flow],
                    value: None,
                    connectedto: None,
                },
                Pin {
                    id: "false".to_string(),
                    pintype: Pintype::Flow,
                    expected_types: vec![DataType::Flow],
                    value: None,
                    connectedto: None,
                },
            ],
        ),
        "add" => (
            4,
            Nodeprops::Nadd(Nadd {}),
            vec![
                Pin {
                    id: "a".to_string(),
                    pintype: Pintype::Data,
                    expected_types: vec![DataType::Int, DataType::Float],
                    value: Some(Valuer::Float(1.0)),
                    connectedto: None,
                },
                Pin {
                    id: "b".to_string(),
                    pintype: Pintype::Data,
                    expected_types: vec![DataType::Int, DataType::Float],
                    value: Some(Valuer::Float(1.0)),
                    connectedto: None,
                },
            ],
            vec![Pin {
                id: "out".to_string(),
                pintype: Pintype::Data,
                expected_types: vec![DataType::Int, DataType::Float],
                value: None,
                connectedto: None,
            }],
        ),
        "getProp" => (
            5,
            Nodeprops::NgetProp(NgetProp {}),
            vec![Pin {
                id: "n".to_string(),
                pintype: Pintype::Data,
                expected_types: vec![DataType::String],
                value: Some(Valuer::String("x".to_string())),
                connectedto: None,
            }],
            vec![Pin {
                id: "p".to_string(),
                pintype: Pintype::Data,
                expected_types: vec![DataType::Any],
                value: None,
                connectedto: None,
            }],
        ),
        _ => panic!("unknown node type in blueprint: '{}'", tstr),
    }
}
pub fn parse_json_node(v: &serde_json::Value, nodes: &mut Vec<Noder>) -> Option<usize> {
    let tstr = v.get("t")?.as_str()?;
    let nodeid = nodes.len();

    let (ty, props, inputs, outputs) = getnodeblueprint(tstr);

    nodes.push(Noder {
        id: nodeid,
        ty,
        inputs,
        outputs,
        props,
    });

    if let Some(inputs_obj) = v.get("inputs").and_then(|i| i.as_object()) {
        let mut new_connections = Vec::new();

        for pin_idx in 0..nodes[nodeid].inputs.len() {
            let pinid = nodes[nodeid].inputs[pin_idx].id.clone();
            if let Some(val) = inputs_obj.get(&pinid) {
                if val.is_object() && val.get("t").is_some() {
                    if let Some(child_idx) = parse_json_node(val, nodes) {
                        let out_pin_id = nodes[child_idx]
                            .outputs
                            .iter()
                            .find(|p| p.pintype == Pintype::Data)
                            .map(|p| p.id.clone())
                            .unwrap_or_else(|| "out".to_string());
                        new_connections.push((pin_idx, child_idx, out_pin_id));
                    }
                } else {
                    nodes[nodeid].inputs[pin_idx].value = match val {
                        serde_json::Value::Number(n) => {
                            if let Some(i) = n.as_i64() {
                                Some(Valuer::Int(i))
                            } else {
                                Some(Valuer::Float(n.as_f64().unwrap_or(0.0)))
                            }
                        }
                        serde_json::Value::String(s) => Some(Valuer::String(s.clone())),
                        serde_json::Value::Bool(b) => Some(Valuer::Bool(*b)),
                        _ => nodes[nodeid].inputs[pin_idx].value.clone(),
                    };
                }
            }
        }

        for (pin_idx, child_idx, out_pin_id) in new_connections {
            nodes[nodeid].inputs[pin_idx].connectedto = Some((child_idx, out_pin_id));
        }
    } else if tstr == "getProp" {
        if let Some(s) = v.get("inputs").and_then(|i| i.as_str()) {
            if let Some(pin) = nodes[nodeid].inputs.iter_mut().find(|p| p.id == "n") {
                pin.value = Some(Valuer::String(s.to_string()));
            }
        }
    }

    if let Some(tojson) = v.get("to") {
        if tojson.is_object() {
            if let Some(nextidx) = parse_json_node(tojson, nodes) {
                let targetoutputpin = if tstr == "if" { "true" } else { "flowout" };

                let pin = nodes[nodeid]
                    .outputs
                    .iter_mut()
                    .find(|p| p.id == targetoutputpin)
                    .unwrap_or_else(|| {
                        panic!(
                            "node type '{}' has no output pin named '{}'",
                            tstr, targetoutputpin
                        )
                    });

                pin.connectedto = Some((nextidx, "flowin".to_string()));
            }
        }
    }

    Some(nodeid)
}
pub fn evaluatepinvaluer(allnodes: &[Noder], node: &Noder, pinid: &str, instance: &Instance) -> Valuer {
    let pin = node
        .inputs
        .iter()
        .find(|p| p.id == pinid)
        .unwrap_or_else(|| {
            let msg = format!("node ID {} is missing input pin '{}'", node.id, pinid);
            log_to_js(&msg);
            panic!("{}", msg);
        });

    let valuer = if let Some((upstreamnodeidx, upstreamppinid)) = &pin.connectedto {
        let upstreamnode = allnodes
            .iter()
            .find(|n| n.id == *upstreamnodeidx)
            .unwrap_or_else(|| panic!("upstream node ID {} not found", upstreamnodeidx));

        let outpin = upstreamnode
            .outputs
            .iter()
            .find(|p| p.id == *upstreamppinid)
            .unwrap_or_else(|| {
                panic!(
                    "upstream output pin '{}' not found on node ID {}",
                    upstreamppinid, upstreamnodeidx
                )
            });
        match &upstreamnode.props {
            Nodeprops::Nadd(_) => {
                let a_val = evaluatedatapinfloat(allnodes, upstreamnode, "a", instance);
                let b_val = evaluatedatapinfloat(allnodes, upstreamnode, "b", instance);
                Valuer::Float(a_val + b_val)
            }
            Nodeprops::NgetProp(_) => {
                let nameval = evaluatedatapinstring(allnodes, upstreamnode, "n", instance);
                match nameval.as_str() {
                    "x" => Valuer::Float(instance.x),
                    _ => {
                        log_to_js("NO NAME IN GETPROP");
                        Valuer::Float(0.0)
                    }
                }
            }
            _ => {
                if let Some(val) = &outpin.value {
                    val.clone()
                } else {
                    panic!(
                        "upstream pin '{}' on node ID {} has no output value",
                        upstreamppinid, upstreamnodeidx
                    )
                }
            }
        }
    } else {
        pin.value.clone().unwrap_or_else(|| {
            let msg = format!(
                "pin '{}' on node ID {} has no values and no connections",
                pinid, node.id
            );
            log_to_js(&msg);
            panic!("{}", msg);
        })
    };

    if !pin.accepts(&valuer) {
        let msg = format!(
            "typeerror on node ID {}: pin '{}' expected types {:?}, but found value {:?}",
            node.id, pinid, pin.expected_types, valuer
        );
        log_to_js(&msg);
        panic!("{}", msg);
    }

    valuer
}

fn evaluatedatapinfloat(allnodes: &[Noder], node: &Noder, pinid: &str, instance: &Instance) -> f64 {
    let valuer = evaluatepinvaluer(allnodes, node, pinid, instance);
    match valuer {
        Valuer::Float(f) => f,
        Valuer::Int(i) => i as f64,
        other => {
            let msg = format!(
                "typeerror on noder ID {}: pin '{}' expected float/int, found {:?}",
                node.id, pinid, other
            );
            log_to_js(&msg);
            panic!("{}", msg);
        }
    }
}

fn evaluatedatapinstring(allnodes: &[Noder], node: &Noder, pinid: &str, instance: &Instance) -> String {
    let valuer = evaluatepinvaluer(allnodes, node, pinid, instance);
    match valuer {
        Valuer::String(s) => s,
        other => {
            let msg = format!(
                "typeerror on noder ID {}: pin '{}' expected string, found {:?}",
                node.id, pinid, other
            );
            log_to_js(&msg);
            panic!("{}", msg);
        }
    }
}

fn evaluatedatapinbool(allnodes: &[Noder], node: &Noder, pinid: &str, instance: &Instance) -> bool {
    let valuer = evaluatepinvaluer(allnodes, node, pinid, instance);
    match valuer {
        Valuer::Bool(b) => b,
        Valuer::Int(i) => i != 0,
        Valuer::Float(f) => f != 0.0,
        Valuer::String(s) => s.to_lowercase() == "true",
        other => {
            let msg = format!(
                "typeerror on noder ID {}: pin '{}' expected bool-compatible type, found {:?}",
                node.id, pinid, other
            );
            log_to_js(&msg);
            panic!("{}", msg);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::engine::{Entity, Instance};

    #[test]
    fn click_move_doubles_x() {
        let json: serde_json::Value = serde_json::from_str(
            r#"[{
                "t":"onClick",
                "to":{
                  "t":"move",
                  "inputs": {
                    "by": {
                      "t":"add",
                      "inputs": {
                        "a": { "t":"getProp", "inputs": { "n": "x" } },
                        "b":0.5
                      }
                    }
                  }
                }
            }]"#,
        )
        .unwrap();

        let mut nodes = Vec::new();
        for n in json.as_array().unwrap() {
            parse_json_node(n, &mut nodes);
        }
        for n in &nodes {
            println!("node {} ty {}", n.id, n.ty);
            for p in &n.inputs {
                println!("  in  {:?} conn {:?} val {:?}", p.id, p.connectedto, p.value);
            }
            for p in &n.outputs {
                println!("  out {:?} conn {:?}", p.id, p.connectedto);
            }
        }

        let mut instance = Instance {
            n: "Bob".into(),
            x: 1.0,
            y: 0.0,
            w: 1.0,
            h: 1.0,
            entity: Entity { components: std::collections::HashMap::new() },
            vars: std::collections::HashMap::new(),
            nodes: nodes.clone(),
            activeexecutionnodes: vec![0],
        };

        for _frame in 0..5 {
            if instance.activeexecutionnodes.is_empty() {
                break;
            }
            let current = std::mem::take(&mut instance.activeexecutionnodes);
            let mut next = Vec::new();
            for node_idx in current {
                println!("executing node {}", node_idx);
                let props = instance.nodes[node_idx].props.clone();
                let nodesclone = instance.nodes.clone();
                next.extend(props.execute(&mut instance, &nodesclone));
            }
            instance.activeexecutionnodes = next;
        }

        println!("final x = {}", instance.x);
        assert_eq!(instance.x, 2.5);
    }
}
