from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()


class User(UserMixin, db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    full_name = db.Column(db.String(150), nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    role = db.Column(
        db.String(20), nullable=False, default="operator"
    )  # admin, operator, viewer
    is_active_user = db.Column(db.Boolean, default=True)
    can_approve_edits = db.Column(db.Boolean, default=False)
    created_at = db.Column(
        db.DateTime, default=lambda: datetime.now()
    )

    # Relationships
    lots_created = db.relationship(
        "Lot", backref="creator", foreign_keys="Lot.created_by"
    )
    test_results_entered = db.relationship(
        "TestResult", backref="entered_by_user", foreign_keys="TestResult.entered_by"
    )
    audit_logs = db.relationship("AuditLog", backref="user", lazy="dynamic")

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    @property
    def is_admin(self):
        return self.role == "admin"

    @property
    def is_lab_owner(self):
        return self.role == "lab_owner"

    @property
    def can_manage_items(self):
        return self.role in ("admin", "lab_owner")

    def __repr__(self):
        return f"<User {self.username}>"


class Item(db.Model):
    __tablename__ = "items"

    id = db.Column(db.Integer, primary_key=True)
    item_number = db.Column(db.String(100), unique=True, nullable=False, index=True)
    item_name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    created_at = db.Column(
        db.DateTime, default=lambda: datetime.now()
    )
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(),
        onupdate=lambda: datetime.now(),
    )

    # Relationships
    lots = db.relationship("Lot", backref="item", lazy="dynamic")
    test_parameters = db.relationship(
        "TestParameter", backref="item", lazy="dynamic", cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<Item {self.item_number}>"


class TestParameter(db.Model):
    """Defines expected test parameters for an item type."""

    __tablename__ = "test_parameters"

    id = db.Column(db.Integer, primary_key=True)
    item_id = db.Column(db.Integer, db.ForeignKey("items.id"), nullable=False)
    parameter_name = db.Column(db.String(150), nullable=False)
    unit = db.Column(db.String(50), nullable=True)
    min_value = db.Column(db.Float, nullable=True)
    max_value = db.Column(db.Float, nullable=True)
    is_required = db.Column(db.Boolean, default=True)

    def __repr__(self):
        return f"<TestParameter {self.parameter_name} for Item {self.item_id}>"


class Lot(db.Model):
    __tablename__ = "lots"

    id = db.Column(db.Integer, primary_key=True)
    lot_number = db.Column(db.String(100), nullable=False, index=True)
    item_id = db.Column(db.Integer, db.ForeignKey("items.id"), nullable=False)
    barcode = db.Column(db.String(200), nullable=True, index=True)
    date_received = db.Column(db.Date, nullable=True)
    status = db.Column(
        db.String(30), nullable=False, default="pending"
    )  # pending, in_progress, completed, flagged
    is_duplicate = db.Column(db.Boolean, default=False)
    duplicate_of_id = db.Column(db.Integer, db.ForeignKey("lots.id"), nullable=True)
    machine = db.Column(db.String(10), nullable=True)
    notified_supervisor = db.Column(db.String(150), nullable=True)
    notes = db.Column(db.Text, nullable=True)
    created_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    created_at = db.Column(
        db.DateTime, default=lambda: datetime.now()
    )
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(),
        onupdate=lambda: datetime.now(),
    )

    # Relationships
    test_results = db.relationship(
        "TestResult", backref="lot", lazy="dynamic", cascade="all, delete-orphan"
    )
    sample_sets = db.relationship(
        "SampleSet", backref="lot", lazy="dynamic",
        cascade="all, delete-orphan", order_by="SampleSet.created_at",
    )
    duplicate_of = db.relationship("Lot", remote_side=[id], backref="duplicates")

    @property
    def is_passing(self):
        """Check if all test results are passing."""
        results = self.test_results.all()
        if not results:
            return None  # No results yet
        return all(r.is_passing for r in results)

    @property
    def sample_set_count(self):
        """Return number of sample sets for this lot."""
        return self.sample_sets.count()

    @property
    def next_sample_set_label(self):
        """Return the next alphabetical label (A, B, C...) for a new sample set."""
        count = self.sample_set_count
        return chr(ord("A") + count)

    def __repr__(self):
        return f"<Lot {self.lot_number}>"


class SampleSet(db.Model):
    __tablename__ = "sample_sets"

    id = db.Column(db.Integer, primary_key=True)
    lot_id = db.Column(db.Integer, db.ForeignKey("lots.id"), nullable=False)
    label = db.Column(db.String(10), nullable=False, default="A")
    created_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    created_at = db.Column(
        db.DateTime, default=lambda: datetime.now()
    )

    # Relationships
    test_results = db.relationship(
        "TestResult", backref="sample_set", lazy="dynamic",
        cascade="all, delete-orphan",
    )
    creator = db.relationship("User", backref="sample_sets_created")

    @property
    def is_passing(self):
        """Check if all test results in this sample set are passing."""
        results = self.test_results.all()
        if not results:
            return None
        return all(r.is_passing for r in results)

    def __repr__(self):
        return f"<SampleSet {self.label} for Lot {self.lot_id}>"


class TestResult(db.Model):
    __tablename__ = "test_results"

    id = db.Column(db.Integer, primary_key=True)
    lot_id = db.Column(db.Integer, db.ForeignKey("lots.id"), nullable=False)
    sample_set_id = db.Column(db.Integer, db.ForeignKey("sample_sets.id"), nullable=True)
    parameter_name = db.Column(db.String(150), nullable=False)
    value = db.Column(db.String(200), nullable=True)
    numeric_value = db.Column(db.Float, nullable=True)
    unit = db.Column(db.String(50), nullable=True)
    min_spec = db.Column(db.Float, nullable=True)
    max_spec = db.Column(db.Float, nullable=True)
    is_passing = db.Column(db.Boolean, nullable=True)
    entered_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    entered_at = db.Column(
        db.DateTime, default=lambda: datetime.now()
    )
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(),
        onupdate=lambda: datetime.now(),
    )

    def evaluate_pass_fail(self):
        """Auto-evaluate pass/fail based on spec limits."""
        if self.numeric_value is not None:
            if self.min_spec is not None and self.numeric_value < self.min_spec:
                self.is_passing = False
            elif self.max_spec is not None and self.numeric_value > self.max_spec:
                self.is_passing = False
            elif self.min_spec is not None or self.max_spec is not None:
                self.is_passing = True
            # If no specs, leave is_passing as None

    def __repr__(self):
        return f"<TestResult {self.parameter_name}={self.value} for Lot {self.lot_id}>"


class AuditLog(db.Model):
    __tablename__ = "audit_log"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    action = db.Column(
        db.String(50), nullable=False
    )  # create, update, delete, login, logout
    table_name = db.Column(db.String(100), nullable=True)
    record_id = db.Column(db.Integer, nullable=True)
    details = db.Column(db.Text, nullable=True)  # JSON string of changes
    ip_address = db.Column(db.String(50), nullable=True)
    timestamp = db.Column(
        db.DateTime, default=lambda: datetime.now(), index=True
    )

    def __repr__(self):
        return f"<AuditLog {self.action} by User {self.user_id} at {self.timestamp}>"


class TestTemplate(db.Model):
    """Reusable test parameter templates that can be loaded into items."""

    __tablename__ = "test_templates"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), unique=True, nullable=False)
    description = db.Column(db.Text, nullable=True)
    created_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    created_at = db.Column(
        db.DateTime, default=lambda: datetime.now()
    )
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(),
        onupdate=lambda: datetime.now(),
    )

    # Relationships
    parameters = db.relationship(
        "TemplateParameter", backref="template", lazy="dynamic", cascade="all, delete-orphan"
    )
    creator = db.relationship("User", backref="templates_created")

    def __repr__(self):
        return f"<TestTemplate {self.name}>"


class TemplateParameter(db.Model):
    """A single parameter definition within a test template."""

    __tablename__ = "template_parameters"

    id = db.Column(db.Integer, primary_key=True)
    template_id = db.Column(db.Integer, db.ForeignKey("test_templates.id"), nullable=False)
    parameter_name = db.Column(db.String(150), nullable=False)
    unit = db.Column(db.String(50), nullable=True)
    min_value = db.Column(db.Float, nullable=True)
    max_value = db.Column(db.Float, nullable=True)
    is_required = db.Column(db.Boolean, default=True)

    def __repr__(self):
        return f"<TemplateParameter {self.parameter_name} for Template {self.template_id}>"


class SystemRequest(db.Model):
    """Feedback tickets / system requests submitted by users."""

    __tablename__ = "system_requests"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    description = db.Column(db.Text, nullable=False)
    screenshot_data = db.Column(db.Text, nullable=True)
    page_url = db.Column(db.String(500), nullable=True)
    status = db.Column(
        db.String(30), nullable=False, default="new"
    )  # new, reviewed, in_progress, completed, dismissed
    admin_notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(
        db.DateTime, default=lambda: datetime.now()
    )
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(),
        onupdate=lambda: datetime.now(),
    )

    # Relationships
    submitter = db.relationship("User", backref="system_requests")


class Supervisor(db.Model):
    __tablename__ = "supervisors"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), unique=True, nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(
        db.DateTime, default=lambda: datetime.now()
    )

    def __repr__(self):
        return f"<Supervisor {self.name}>"
