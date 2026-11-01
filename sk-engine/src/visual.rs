use crate::data::*;
use crate::engine::Instance;
use crate::log_to_js;
use std::collections::HashMap;

#[derive(Clone, Debug, PartialEq)]
pub enum Pintype {
    Flow,
    Data,
}

#[derive(Clone, Debug)]
pub struct Pin {
    pub id: String,
    pub pintype: Pintype,
    pub value: Option<Valuer>,
    pub connectedto: Option<(usize, String)>,
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
pub enum Nodeprops {
    NonStart(NonStart),
    Nmove(Nmove),
    NonClick(NonClick),
    Nif(Nif),
    Nadd(Nadd),
}

impl Nodeprops {
    pub fn execute(&self, instance: &mut Instance, allnodes: &[Noder]) -> Vec<usize> {
        let currentnode = allnodes.iter().find(|n| match (&n.props, self) {
            (Nodeprops::NonStart(_), Nodeprops::NonStart(_)) => true,
            (Nodeprops::Nmove(_), Nodeprops::Nmove(_)) => true,
            (Nodeprops::NonClick(_), Nodeprops::NonClick(_)) => true,
            (Nodeprops::Nif(_), Nodeprops::Nif(_)) => true,
            _ => false,
        }).expect("node context error");

        match self {
            Nodeprops::NonStart(_) => {
                log_to_js("start node triggered");
                getconnectedflowoutputs(currentnode, "flowout")
            }
            Nodeprops::Nmove(_) => {
                let moveval = evaluatedatapinfloat(allnodes, currentnode, "by");
                instance.x += moveval;
                log_to_js(&format!("[{}] moved  x: {}", instance.n, instance.x));
                getconnectedflowoutputs(currentnode, "flowout")
            }
            Nodeprops::NonClick(_) => {
                log_to_js(&format!("[{}] click ***", instance.n));
                getconnectedflowoutputs(currentnode, "flowout")
            }
            Nodeprops::Nif(_) => {
                let conditiontrue = evaluatedatapinbool(allnodes, currentnode, "condition");
                if conditiontrue {
                    log_to_js("If condition: true");
                    getconnectedflowoutputs(currentnode, "true")
                } else {
                    log_to_js("If condition: false");
                    getconnectedflowoutputs(currentnode, "false")
                }
            }
            Nodeprops::Nadd(_) => {
                let moveval = evaluatedatapinfloat(allnodes, currentnode, "by");
                instance.x += moveval;
                log_to_js(&format!("[{}] moved to x: {}", instance.n, instance.x));
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
            vec![Pin { id: "flowout".to_string(), pintype: Pintype::Flow, value: None, connectedto: None }],
        ),
        "move" => (
            1,
            Nodeprops::Nmove(Nmove {}),
            vec![
                Pin { id: "flowin".to_string(), pintype: Pintype::Flow, value: None, connectedto: None },
                Pin { id: "by".to_string(), pintype: Pintype::Data, value: Some(Valuer::Float(1.0)), connectedto: None },
            ],
            vec![Pin { id: "flowout".to_string(), pintype: Pintype::Flow, value: None, connectedto: None }],
        ),

        "onClick" => (
            2,
            Nodeprops::NonClick(NonClick {}),
            vec![],
            vec![Pin { id: "flowout".to_string(), pintype: Pintype::Flow, value: None, connectedto: None }],
        ),
        "if" => (
            3,
            Nodeprops::Nif(Nif {}),
            vec![
                Pin { id: "flowin".to_string(), pintype: Pintype::Flow, value: None, connectedto: None },
                Pin { id: "condition".to_string(), pintype: Pintype::Data, value: Some(Valuer::Bool(true)), connectedto: None },
            ],
            vec![
                Pin { id: "true".to_string(), pintype: Pintype::Flow, value: None, connectedto: None },
                Pin { id: "false".to_string(), pintype: Pintype::Flow, value: None, connectedto: None },
            ],
        ),
        "add" => (
            4,
            Nodeprops::Nadd(Nadd {}),
            vec![
                Pin { id: "a".to_string(), pintype: Pintype::Data, value: Some(Valuer::Float(1.0)), connectedto: None },
            ],
            vec![Pin { id: "out".to_string(), pintype: Pintype::Data, value: None, connectedto: None }],
        ),
        _ => panic!("unknown node type in blueprint: '{}'", tstr),
    }
}

pub fn parse_json_node(v: &serde_json::Value, nodes: &mut Vec<Noder>) -> Option<usize> {
    let tstr = v.get("t")?.as_str()?;
    let nodeid = nodes.len();

    let (ty, props, mut inputs, outputs) = getnodeblueprint(tstr);


    nodes.push(Noder {
        id: nodeid,
        ty,
        inputs,
        outputs,
        props,
    });

    if let Some(tojson) = v.get("to") {
        if tojson.is_object() {
            if let Some(nextidx) = parse_json_node(tojson, nodes) {
                let targetoutputpin = if tstr == "if" { "true" } else { "flowout" };

                let pin = nodes[nodeid].outputs.iter_mut()
                    .find(|p| p.id == targetoutputpin)
                    .unwrap_or_else(|| panic!("node type '{}' has no output pin named '{}'", tstr, targetoutputpin));
                    
                pin.connectedto = Some((nextidx, "flowin".to_string()));
            }
        }
    }

    Some(nodeid)
}

pub fn evaluatepinvaluer(allnodes: &[Noder], node: &Noder, pinid: &str) -> Valuer {
    let pin = node.inputs.iter()
        .find(|p| p.id == pinid)
        .unwrap_or_else(|| {
            let msg = format!("node ID {} is missing input pin '{}'", node.id, pinid);
            log_to_js(&msg);
            panic!("{}", msg);
        });

    if let Some((upstreamnodeidx, upstreamppinid)) = &pin.connectedto {
        let upstreamnode = allnodes.iter()
            .find(|n| n.id == *upstreamnodeidx)
            .unwrap_or_else(|| panic!("upstream node ID {} not found", upstreamnodeidx));
        
        let outpin = upstreamnode.outputs.iter()
            .find(|p| p.id == *upstreamppinid)
            .unwrap_or_else(|| panic!("Upstream output pin '{}' not found on node ID {}", upstreamppinid, upstreamnodeidx));

        if let Some(val) = &outpin.value {
            return val.clone();
        } else {
            panic!("Upstream pin '{}' on node ID {} has no output value", upstreamppinid, upstreamnodeidx);
        }
    }

    pin.value.clone().unwrap_or_else(|| {
        let msg = format!("pin '{}' on node ID {} has no values and no connections", pinid, node.id);
        log_to_js(&msg);
        panic!("{}", msg);
    })
}

fn evaluatedatapinfloat(allnodes: &[Noder], node: &Noder, pinid: &str) -> f64 {
    let valuer = evaluatepinvaluer(allnodes, node, pinid);
    match valuer {
        Valuer::Float(f) => f,
        Valuer::Int(i) => i as f64,
        other => {
            let msg = format!("typeerror on noder ID {}: pin '{}' expected float/int, found {:?}", node.id, pinid, other);
            log_to_js(&msg);
            panic!("{}", msg);
        }
    }
}

fn evaluatedatapinbool(allnodes: &[Noder], node: &Noder, pinid: &str) -> bool {
    let valuer = evaluatepinvaluer(allnodes, node, pinid);
    match valuer {
        Valuer::Bool(b) => b,
        Valuer::Int(i) => i != 0,
        Valuer::Float(f) => f != 0.0,
        Valuer::String(s) => s.to_lowercase() == "true",
        other => {
            let msg = format!("typeerror on noder ID {}: pin '{}' expected bool-compatible type, found {:?}", node.id, pinid, other);
            log_to_js(&msg);
            panic!("{}", msg);
        }
    }
}