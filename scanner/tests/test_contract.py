import contract_mod as C


def test_severity_band_thresholds():
    assert C.severity_band(0) == "low"
    assert C.severity_band(33) == "low"
    assert C.severity_band(34) == "medium"
    assert C.severity_band(66) == "medium"
    assert C.severity_band(67) == "high"
    assert C.severity_band(100) == "high"


def test_derived_severity_matches_band():
    assert C.normalize_drift_verdict({"drift_score": 10, "reasoning": "x"})["severity"] == "low"
    assert C.normalize_drift_verdict({"drift_score": 50, "reasoning": "x"})["severity"] == "medium"
    assert C.normalize_drift_verdict({"drift_score": 80, "reasoning": "x"})["severity"] == "high"


def test_normalize_clamps_out_of_range():
    assert C.normalize_drift_verdict({"drift_score": 150})["drift_score"] == 100
    assert C.normalize_drift_verdict({"drift_score": -10})["drift_score"] == 0


def test_validator_accepts_consistent():
    assert C.validate_drift_verdict({"drift_score": 80, "severity": "high", "reasoning": "ok"}) is True
    assert C.validate_drift_verdict({"drift_score": 20, "severity": "low", "reasoning": "ok"}) is True


def test_validator_rejects_out_of_range():
    assert C.validate_drift_verdict({"drift_score": 120, "severity": "high", "reasoning": "x"}) is False
    assert C.validate_drift_verdict({"drift_score": -1, "severity": "low", "reasoning": "x"}) is False


def test_validator_rejects_bad_enum_and_mismatched_band():
    # bad enum value
    assert C.validate_drift_verdict({"drift_score": 80, "severity": "critical", "reasoning": "x"}) is False
    # valid enum but wrong band for the score
    assert C.validate_drift_verdict({"drift_score": 80, "severity": "low", "reasoning": "x"}) is False
    assert C.validate_drift_verdict({"drift_score": 10, "severity": "high", "reasoning": "x"}) is False


def test_validator_rejects_bad_types_and_empty_reasoning():
    assert C.validate_drift_verdict({"drift_score": "80", "severity": "high", "reasoning": "x"}) is False
    assert C.validate_drift_verdict({"drift_score": True, "severity": "low", "reasoning": "x"}) is False
    assert C.validate_drift_verdict({"drift_score": 80, "severity": "high", "reasoning": ""}) is False


def test_normalized_output_always_passes_validator():
    for s in range(-20, 130, 3):
        v = C.normalize_drift_verdict({"drift_score": s})
        assert C.validate_drift_verdict(v) is True
